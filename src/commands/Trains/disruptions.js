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
        function textSplit(text, maxLength = 1024) {
            const chunks = [];
            let current = text;

            while (current.length > maxLength) {
                let sliceIndex = current.lastIndexOf('\n', maxLength);
                if (sliceIndex === -1) sliceIndex = maxLength;
                chunks.push(current.slice(0, sliceIndex));
                current = current.slice(sliceIndex).trim();

            }
            if (current.length) chunks.push(current);
            return chunks
        }

        try {
            const statusRes = await fetch(`https://api.tfl.gov.uk/Line/Mode/tube/Status?app_key=${process.env.tflapi}`, {
                headers: {
                    'Cache-Control': 'no-cache'
                },
            });
            const statusData = await statusRes.json();


            const disruptedLines = statusData.filter(line =>
                line.lineStatuses.some(status => status.statusSeverity !== 10)
            );

            const embed = new EmbedBuilder()
                .setTitle('🚇 TfL Service Status')
                .setColor(disruptedLines.length ? 'Yellow' : 'Green')
                .setTimestamp();

            // Section: Major Alerts 
            const majorAlerts = disruptedLines.length
                ? disruptedLines.map(line => {
                    const reason = line.lineStatuses.find(s => s.statusSeverity !== 10 && s.reason)?.reason || 'No detailed reason.';
                    return `${line.name}: ${reason}`;
                }).join('\n\n')
                : '✅ No major alerts at this time.';

            const majorAlertChunks = textSplit(majorAlerts);
            majorAlertChunks.forEach((chunk, i) => {
                embed.addFields({
                    name: i === 0 ? '❗ __Alerts__' : '❗ __Alerts__ (cont.)',
                    value: `\`\`\`${chunk}\`\`\``,
                });
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
