const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'nexttrain',
    description: 'Shows the next 6 trains arriving at a specified station.',
    usage: '/nexttrain [stationName]',

    permissions: [],
    ownerOnly: false,
    guildOnly: true,

    data: new SlashCommandBuilder()
        .setName('nexttrain')
        .setDescription('Shows the next 6 trains arriving at a specified station.')
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
            return trainEmbed(interaction, searchData.matches[0].id, searchData.matches[0].name, true);
        }

        const options = searchData.matches.slice(0, 25).map(match => ({
            label: match.name,
            value: match.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('nextTrainSelect')
            .setPlaceholder('Please select the station to view train arrivals')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
            content: `🔎 Multiple stations found for **${stationQuery}**. Please select one:`,
            components: [row]
        });
    },

    handleSelectMenu: async (interaction) => {
        await interaction.deferUpdate();

        const stationId = interaction.values[0];

        try {
            const stopRes = await fetch(`https://api.tfl.gov.uk/StopPoint/${stationId}?app_key=${process.env.tflapi}`);
            const stopData = await stopRes.json();

            const stationName = stopData.commonName || 'Unknown Station';

            return trainEmbed(interaction, stationId, stationName, true);
        } catch (err) {
            console.error('Error fetching selected station data:', err);
            await interaction.editReply({ content: '⚠️ Failed to load train data.', components: [] });
        }
    }
};

async function trainEmbed(interaction, stationId, stationName, edit = false) {
    try {
        const arrivalsRes = await fetch(`https://api.tfl.gov.uk/StopPoint/${stationId}/Arrivals?app_key=${process.env.tflapi}`);
        const arrivals = await arrivalsRes.json();

        if (!arrivals.length) {
            const msg = { content: `ℹ️ No upcoming trains found for **${stationName}**.`, components: [] };
            return edit ? await interaction.editReply(msg) : await interaction.followUp(msg);
        }

        const sortedArrivals = arrivals.sort((a, b) => a.timeToStation - b.timeToStation).slice(0, 6);

        const arrivalList = sortedArrivals.map(train => {
            const time = Math.round(train.timeToStation / 60);
            return `• **${train.lineName}** to *${train.destinationName}* – \`${time} min\``;
        });

        const embed = new EmbedBuilder()
            .setTitle(`🚆 Next trains at ${stationName}`)
            .setDescription(arrivalList.join('\n') || '``No trains available.``')
            .setColor('fc9712')
            .setFooter({ text: 'Data provided by Transport for London (TfL)' })
            .setTimestamp();

        if (edit) {
            await interaction.editReply({ embeds: [embed], components: [] });
        } else {
            await interaction.followUp({ embeds: [embed] });
        }

    } catch (err) {
        console.error('Error fetching train arrivals:', err);
        const errorMessage = { content: '⚠️ Failed to load train data.', components: [] };
        return edit ? await interaction.editReply(errorMessage) : await interaction.followUp(errorMessage);
    }
}
