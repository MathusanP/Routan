const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'station',
    description: 'Shows information about the requested station.',
    usage: '/station [stationName]',

    permissions: [],
    ownerOnly: false,
    guildOnly: true,

    data: new SlashCommandBuilder()
        .setName('station')
        .setDescription('Shows information about the requested station.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The station name')
                .setRequired(true)
        ),

    error: false,

    execute: async ({ interaction }) => {
        const stationQuery = interaction.options.getString('name');

        const searchUrl = `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(stationQuery)}?modes=tube,dlr,overground,elizabeth-line,national-rail&app_key=${process.env.tflapi}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (!searchData.matches || searchData.matches.length === 0) {
            return interaction.editReply({
                content: `❌ Could not find the station **${stationQuery}**. Please check the spelling and try again.`
            });
        }

        if (searchData.matches.length === 1) {
            return stationEmbed(interaction, searchData.matches[0].id, true);
        }

        const options = searchData.matches.slice(0, 25).map(match => ({
            label: match.name,
            value: match.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('stationSelect')
            .setPlaceholder('Please select the station you would like to view.')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
            content: `🔎 Multiple stations found for **${stationQuery}**. Please select one:`,
            components: [row]
        });
    },

    // 👇 New handler for select menu interactions
    handleSelectMenu: async (interaction) => {
        await interaction.deferUpdate(); // prevents interaction timeout

        const stationId = interaction.values[0];

        try {
            const res = await fetch(`https://api.tfl.gov.uk/StopPoint/${stationId}?app_key=${process.env.tflapi}`);
            const station = await res.json();
            console.log

            const name = station.commonName;
            const lines = station.lines?.map(line => line.name).join(', ') || 'Unknown';
            const zone = station.additionalProperties?.find(p => p.key === 'Zone')?.value || 'Unknown';
            const modes = station.modes?.join(', ') || 'Unknown';
            const status = station.status ? '✅ Open' : '❌ Closed';

            const embed = new EmbedBuilder()
                .setTitle(`${name}`)
                .addFields(
                    { name: 'Lines Served', value: lines, inline: false },
                    { name: 'Zone', value: zone, inline: true },
                    { name: 'Modes', value: modes, inline: true },
                    { name: 'Status', value: status, inline: true }
                )
                .setColor(0x1d7af3)
                .setFooter({ text: 'Data provided by Transport for London (TfL)' });

            await interaction.editReply({ embeds: [embed], components: [] });

        } catch (err) {
            console.error('Error fetching station from select menu:', err);
            await interaction.editReply({ content: '⚠️ Failed to load station data.', components: [] });
        }
    }
};

async function stationEmbed(interaction, stationId, edit = false) {
    try {
        const res = await fetch(`https://api.tfl.gov.uk/StopPoint/${stationId}?app_key=${process.env.tflapi}`);
        const station = await res.json();

        const name = station.commonName;
        const lines = station.lines?.map(line => line.name).join(', ') || 'Unknown';
        const zone = station.additionalProperties?.find(p => p.key === 'Zone')?.value || 'Unknown';
        const modes = station.modes?.join(', ') || 'Unknown';
        const status = station.status ? '✅ Open' : '❌ Closed';
        
        const embed = new EmbedBuilder()
            .setTitle(`${name}`)
            .setDescription(`\u200B`)
            .addFields(
                { name: 'Lines Served', value: lines, inline: false },
                { name: 'Zone', value: zone, inline: true },
                { name: 'Modes', value: modes, inline: true },
                { name: 'Status', value: status, inline: true }
            )
            .setColor(0x1d7af3)
            .setFooter({ text: 'Data provided by Transport for London (TfL)' });

        if (edit) {
            await interaction.editReply({ embeds: [embed], components: [] });
        } else {
            await interaction.followUp({ embeds: [embed] });
        }
    } catch (err) {
        console.error('Error fetching station:', err);
        const errorMessage = { content: '⚠️ Failed to load station data.', components: [] };
        if (edit) await interaction.editReply(errorMessage);
        else await interaction.followUp(errorMessage);
    }
}
