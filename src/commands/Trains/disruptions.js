const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'disruptions',
    description: 'Shows if there are any major disruptions in the TFL.',
    usage: '',

    permissions: [],
    ownerOnly: false,
    guildOnly: true,

    data: new SlashCommandBuilder()
        .setName('disruptions')
        .setDescription('Shows if there are any major disruptions in the TFL.'),

    error: false,
    execute: async ({ interaction, client }) => {
        try {
            // Fetch current line status (real-time disruptions)
            const statusRes = await fetch(`https://api.tfl.gov.uk/Line/Mode/tube/Status?app_key=${process.env.tflapi}`, {
                headers: {
                    'Cache-Control': 'no-cache'
                },
            });
            const statusData = await statusRes.json();

            // Filter lines with actual disruptions (statusSeverity != 10)
            const disruptedLines = statusData.filter(line =>
                line.lineStatuses.some(status => status.statusSeverity !== 10)
            );

            // Build embed
            const embed = new EmbedBuilder()
                .setTitle('🚇 TfL Service Status')
                .setColor(disruptedLines.length ? 'Yellow' : 'Green')
                .setTimestamp();

            // Section: Major Alerts (formerly yellow banner)
            const majorAlertsText = disruptedLines.length
                ? disruptedLines.map(line => {
                    const reason = line.lineStatuses
                        .find(status => status.statusSeverity !== 10 && status.reason)?.reason || 'No detailed reason.';
                    return `${line.name}: ${reason}`;
                }).join('\n\n').slice(0, 1024)
                : '✅ No major alerts at this time.';

            embed.addFields({
                name: '❗ __Alerts__',
                value: `\`\`\`${majorAlertsText}\`\`\``,
            });

            // Section: Planned works / tube disruptions
            const disruptionRes = await fetch(`https://api.tfl.gov.uk/Line/Mode/tube/Disruption?app_key=${process.env.tflapi}`, {
                headers: {
                    'Cache-Control': 'no-cache'
                },
            });
            const disruptions = await disruptionRes.json();

            const disruptionText = disruptions.length
                ? Array.from(
                    new Map(
                        disruptions.map(d => {
                            const desc = d.description?.replace(/\s+/g, ' ').trim() ?? 'No description';
                            return [desc, desc];
                        })
                    ).values()
                ).join('\n\n').slice(0, 1024)
                : '✅ No tube disruptions at this time.';

            embed.addFields({
                name: '🚦 __Current Disruptions__',
                value: `\`\`\`${disruptionText}\`\`\``,
            });

            embed.setFooter({
                text: 'Data provided by Transport for London (TfL)',
            });

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.followUp({
                content: '❌ Failed to fetch TfL status. Please try again later.',
                ephemeral: true,
            });
        }
    }
};
