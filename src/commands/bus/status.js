const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'status',
    description: 'Shows if a London bus route has any current or planned disruptions.',
    usage: '/status [bus]',

    permissions: [],
    ownerOnly: false,
    guildOnly: true,

    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check status of a London bus route.')
        .addStringOption(option =>
            option
                .setName('bus')
                .setDescription('Bus number (e.g., 25, 300, N18)')
                .setRequired(true)
        ),

    error: false,

    execute: async ({ interaction }) => {
        const busNumber = interaction.options.getString('bus');

        try {
            const res = await fetch(`https://api.tfl.gov.uk/Line/${encodeURIComponent(busNumber)}/Status`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'app_key': process.env.tflapi,
                },
            });

            const lines = await res.json();

            const embed = new EmbedBuilder()
                .setTitle(`🚌  Status for Bus ${busNumber}`)
                .setTimestamp()
                .setFooter({ text: 'Data provided by Transport for London (TfL)' });

            if (!lines.length || !lines[0].lineStatuses?.length) {
                embed
                    .setColor('Green')
                    .setDescription('✅ No current or planned disruptions. Route is running normally.');
            } else {
                const nonGoodStatuses = lines[0].lineStatuses.filter(
                    status => status.statusSeverityDescription !== 'Good Service'
                );

                if (nonGoodStatuses.length === 0) {
                    embed
                        .setColor('Green')
                        .setDescription('✅ No current or planned disruptions. Route is running normally.');
                } else {
                    const statusText = nonGoodStatuses
                        .map(status => `• ${status.statusSeverityDescription}\n${status.reason || 'No further details.'}`)
                        .join('\n\n')
                        .slice(0, 4000);

                    embed
                        .setColor('Yellow')
                        .setDescription(`\`\`\`${statusText}\`\`\``);
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: '❌ Failed to fetch bus status. Please try again later.',
            });
        }
    }
};
