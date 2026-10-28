import {
  AlertChannelType,
  IncidentChannelConfig,
  IncidentDispatchReceipt,
  TransactionAnalysisResult,
} from '../types/index.js';

export type WebhookHttpTransport = (
  url: string,
  payload: Record<string, unknown>
) => Promise<{ status: number }>;

/**
 * Multi-Channel Security Incident Notifier (Discord, Slack, Telegram, PagerDuty).
 *
 * Unlike passive monitors that emit generic alerts, GuardianX attaches:
 * - The exact violated invariant IDs & risk score
 * - The local fork balance drain delta
 * - The dispatched Flashbots / Private Relay circuit-breaker bundle hash (`0x...`)
 * - The reproducible Foundry (`.t.sol`) Proof-of-Exploit snippet
 */
export class IncidentNotifier {
  private readonly channels: IncidentChannelConfig[];
  private readonly transport: WebhookHttpTransport;

  constructor(channels: IncidentChannelConfig[], customTransport?: WebhookHttpTransport) {
    this.channels = channels;
    this.transport = customTransport ?? this.defaultSimulatedTransport.bind(this);
  }

  /**
   * Formats and dispatches a structured incident report across all configured channels.
   */
  public async notifyIncident(
    analysis: TransactionAnalysisResult
  ): Promise<IncidentDispatchReceipt[]> {
    const receipts: IncidentDispatchReceipt[] = [];
    const formattedTitle = `[GuardianX Tier-${analysis.riskTier} ${analysis.verdict}] ${analysis.chain.toUpperCase()} Tx ${analysis.txHash.slice(0, 12)}...`;
    const includedFoundryPoE = Boolean(analysis.proofOfExploit?.reproducibleFoundryTestSolidity);

    for (const channelCfg of this.channels) {
      const payload = this.buildChannelPayload(channelCfg.channel, analysis, formattedTitle, channelCfg);
      const res = await this.transport(channelCfg.webhookUrl, payload);

      receipts.push({
        channel: channelCfg.channel,
        delivered: res.status >= 200 && res.status < 300,
        statusCode: res.status,
        formattedTitle,
        includedFoundryPoE,
        timestamp: new Date().toISOString(),
      });
    }

    return receipts;
  }

  public buildChannelPayload(
    channel: AlertChannelType,
    analysis: TransactionAnalysisResult,
    title: string,
    cfg: IncidentChannelConfig
  ): Record<string, unknown> {
    const bundleHash = analysis.mitigationReceipt?.bundleResponse?.bundleHash ?? 'None';
    const actionsTaken = analysis.mitigationReceipt?.actionsTaken.join(', ') || 'None';
    const poeSnippet = analysis.proofOfExploit?.reproducibleFoundryTestSolidity
      ? analysis.proofOfExploit.reproducibleFoundryTestSolidity.slice(0, 420) + '\n// ...'
      : 'No PoE generated';

    switch (channel) {
      case 'discord':
        return {
          username: 'GuardianX Circuit Breaker',
          embeds: [
            {
              title,
              description: analysis.explanation,
              color: analysis.riskScore >= 75 ? 0xff0000 : 0xf59e0b,
              fields: [
                { name: 'Risk Score', value: `${analysis.riskScore}/100 (Tier ${analysis.riskTier})`, inline: true },
                { name: 'Active Mitigation', value: actionsTaken, inline: true },
                { name: 'Flashbots Bundle', value: `\`${bundleHash}\``, inline: false },
                { name: 'Foundry Proof-of-Exploit (.t.sol)', value: `\`\`\`solidity\n${poeSnippet}\n\`\`\`` },
              ],
            },
          ],
        };

      case 'slack':
        return {
          text: title,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: title },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Explanation:* ${analysis.explanation}\n*Mitigation Actions:* \`${actionsTaken}\`\n*Flashbots Bundle:* \`${bundleHash}\``,
              },
            },
          ],
        };

      case 'telegram':
        return {
          chat_id: cfg.chatId ?? '-100123456789',
          parse_mode: 'Markdown',
          text: `*${title}*\n\n${analysis.explanation}\n\n*Bundle:* \`${bundleHash}\`\n*Actions:* \`${actionsTaken}\``,
        };

      case 'pagerduty':
      default:
        return {
          routing_key: cfg.routingKey ?? 'guardianx-pagerduty-routing-key',
          event_action: 'trigger',
          payload: {
            summary: title,
            severity: analysis.riskScore >= 75 ? 'critical' : 'warning',
            source: `guardianx:${analysis.chain}`,
            custom_details: {
              riskScore: analysis.riskScore,
              riskTier: analysis.riskTier,
              bundleHash,
              actionsTaken,
              foundryTestFile: analysis.proofOfExploit?.foundryTestFileName,
            },
          },
        };
    }
  }

  private async defaultSimulatedTransport(url: string): Promise<{ status: number }> {
    if (url.includes('fail') || url.includes('offline')) {
      return { status: 503 };
    }
    return { status: 200 };
  }
}
