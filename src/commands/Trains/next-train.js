const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

        const stationId = searchData.matches[0].id;

        const arrivalsRes = await fetch(`https://api.tfl.gov.uk/StopPoint/${stationId}/Arrivals?app_key=${process.env.tflapi}`);
        const arrivals = await arrivalsRes.json();

        if (!arrivals.length) {
            return interaction.editReply({
                content: `ℹ️ No upcoming trains found for **${searchData.matches[0].name}**.`
            });
        }

        // Sort by timeToStation (seconds until arrival)
        const sortedArrivals = arrivals.sort((a, b) => a.timeToStation - b.timeToStation).slice(0, 6);

        const arrivalList = sortedArrivals.map(train => {
            const time = Math.round(train.timeToStation / 60);
            return `• **${train.lineName}**  to *${train.destinationName}* – \`${time} min\``;
        });

        const embed = new EmbedBuilder()
            .setTitle(`🚆 Next trains at ${searchData.matches[0].name}`)
            .setDescription(arrivalList.join('\n') || '``No trains available.``')
            .setColor('fc9712')
            .setFooter({ text: 'Data provided by Transport for London (TfL)' })
            .setTimestamp()

        return interaction.editReply({ embeds: [embed] });
    }
};
