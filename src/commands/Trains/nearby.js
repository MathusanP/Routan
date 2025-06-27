const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'nearby',
    description: 'Uses submitted location to find the nearest stations.',
    usage: '/nearby [location]',

    permissions: [],

    data: new SlashCommandBuilder()
        .setName('nearby')
        .setDescription('Finds the nearest station to a location or postcode.')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Postcode or general area.')
                .setRequired(true)
        ),

    error: false,

    execute: async ({ interaction }) => {
        const locationQuery = interaction.options.getString('location');

        const geo = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`, {
            headers: { 'User-Agent': `bus-times (${process.env.email})` }
        });

        const geoLoc = await geo.json();

        if (!geoLoc.length) {
            return interaction.followUp({
                content: `❌ Could not find where **${locationQuery}** is.`
            });
        }

        const { lat, lon, display_name } = geoLoc[0];

        const tflUrl = `https://api.tfl.gov.uk/StopPoint?lat=${lat}&lon=${lon}&stopTypes=NaptanMetroStation,NaptanRailStation&radius=1609&app_key=${process.env.tflapi}`; // 1 mile radius
        const tflRes = await fetch(tflUrl);
        const tflData = await tflRes.json();

        if (!tflData.stopPoints || tflData.stopPoints.length === 0) {
            return interaction.followUp({
                content: `🚫 No nearby stations found near **${display_name}**.`
            });
        }

        const nearestStations = tflData.stopPoints
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3) // only top 3
            .map(stop => {
                const miles = (stop.distance / 1609.34).toFixed(2); // meters to miles
                return `• **${stop.commonName}** — \` ${miles} miles away\``;
            });

        const embed = new EmbedBuilder()
            .setTitle('📍 Nearest Stations')
            .setDescription(`From: **${display_name}**\n\n${nearestStations.join('\n')}`)
            .setColor(0x4caf50)
            .setFooter({ text: 'Data from OpenStreetMap & Transport for London' })
            .setTimestamp();

        return interaction.followUp({ embeds: [embed] });
    }
};
