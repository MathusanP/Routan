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
            // Fetch banner alerts
            const bannerRes = await fetch('https://api.tfl.gov.uk/status/yellowbannermessages', {
                headers: {
                    'Cache-Control': 'no-cache',
                    'app_key': process.env.tflapi,
                },
            });
            const bannerData = await bannerRes.json();

            // Fetch tube disruptions
            const disruptionRes = await fetch('https://api.tfl.gov.uk/Line/Mode/tube/Disruption', {
                headers: {
                    'Cache-Control': 'no-cache',
                    'app_key': process.env.tflapi,
                },
            });
            const disruptions = await disruptionRes.json();

            // Build embed
            const embed = new EmbedBuilder()
                .setTitle('🚦 TfL Service Status')
                .setColor(disruptions.length || (bannerData.messages?.length ?? 0) ? 'Yellow' : 'Green')
                .setTimestamp();

            // Section: Banner Alerts
            const bannerText = bannerData.messages?.length
                ? bannerData.messages.map(msg => `• ${msg.message}`).join('\n').slice(0, 1024)
                : '✅ No major alerts at this time.';

            embed.addFields({
                name: '🟡 __Major Alerts__',
                value: `\`${bannerText}\``,
            });

            // Section: Tube Disruptions
            const disruptionText = disruptions.length
                ? Array.from(
                    new Map(
                        disruptions.map(d => {
                            const desc = d.description?.replace(/\s+/g, ' ').trim() ?? 'No description';

                            // Key: line + desc to avoid duplicates
                            return [`${desc}`, `${desc}`];
                        })
                    ).values()
                ).join('\n\n').slice(0, 1024)
                : '✅ No tube disruptions at this time.';


            embed.addFields({
                name: '🚇 __Tube Disruptions__',
                value: `\`\`${disruptionText}\`\``,
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