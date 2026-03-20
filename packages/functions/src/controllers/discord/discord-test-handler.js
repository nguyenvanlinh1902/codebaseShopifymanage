import {DiscordService} from '../../services/discord-service.js';

/**
 * POST /api/discord/test
 * Test Discord bot connection and send a sample embed
 */
export async function testConnection(req, res) {
  try {
    const discordService = await DiscordService.createFromConfig((req.query.storeId || 'default'));
    if (!discordService) {
      return res.status(404).json({success: false, error: 'Discord not configured'});
    }

    const connectionResult = await discordService.testConnection();
    if (!connectionResult.success) {
      return res.status(400).json({
        success: false,
        error: `Cannot access channel: ${connectionResult.error}`
      });
    }

    // Send test embed
    const testEmbed = discordService.createEmailEmbed({
      subject: 'Test Email from Gmail Integration',
      from: 'test@example.com',
      snippet: 'This is a test message to verify your Discord integration is working correctly.',
      labels: ['INBOX', 'UNREAD'],
      date: new Date().toISOString(),
      isRead: false,
      accountEmail: 'test@example.com'
    });
    await discordService.sendEmbed(testEmbed);

    return res.json({
      success: true,
      data: {channelName: connectionResult.channelName, messageSent: true}
    });
  } catch (error) {
    console.error('[Discord:Test] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
