const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const proj4 = require('proj4');

// Define British National Grid projection
proj4.defs("EPSG:27700",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 " +
  "+x_0=400000 +y_0=-100000 +ellps=airy " +
  "+towgs84=446.448,-125.157,542.06,0.1502,0.247,0.8421,-20.4894 " +
  "+units=m +no_defs"
);

module.exports = {
    name: 'nearby',
    description: 'Finds the nearest train stations.',
    usage: '/nearby [location]',

    permissions: [],

    data: new SlashCommandBuilder()
        .setName('nearby')
        .setDescription('Finds the nearest stations.')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Postcode or general area.')
                .setRequired(true)
        ),

    error: false,

    execute: async ({ interaction }) => {
        const locationQuery = interaction.options.getString('location');

        let lat, lon, display_name;

        try {
            // Try using TFL search first
            const tflSearchRes = await fetch(`https://api.tfl.gov.uk/StopPoint/Search?query=${encodeURIComponent(locationQuery)}&app_key=${process.env.tflapi}`);
            const tflSearchData = await tflSearchRes.json();

            if (tflSearchData.matches && tflSearchData.matches.length > 0) {
                const matchId = tflSearchData.matches[0].id;
                const stopInfoRes = await fetch(`https://api.tfl.gov.uk/StopPoint/${matchId}?app_key=${process.env.tflapi}`);
                const stopInfo = await stopInfoRes.json();

                if (stopInfo.lat && stopInfo.lon) {
                    lat = stopInfo.lat;
                    lon = stopInfo.lon;
                    display_name = stopInfo.commonName;
                }
            }

            // If not found via TFL, use OS Maps
            if (!lat || !lon) {
                const geoRes = await fetch(`https://api.os.uk/search/names/v1/find?query=${encodeURIComponent(locationQuery)}&key=${process.env.osApi}`);
                const geoData = await geoRes.json();

                if (!geoData.results || geoData.results.length === 0) {
                    return interaction.followUp({
                        content: `❌ Could not find where **${locationQuery}** is.`
                    });
                }

                const entry = geoData.results[0].GAZETTEER_ENTRY;
                [lon, lat] = proj4('EPSG:27700', 'EPSG:4326', [entry.GEOMETRY_X, entry.GEOMETRY_Y]);
                display_name = entry.NAME1;
            }

            // Query nearest stations
            const tflUrl = `https://api.tfl.gov.uk/StopPoint?lat=${lat}&lon=${lon}&stopTypes=NaptanMetroStation,NaptanRailStation&radius=1609&app_key=${process.env.tflapi}`;
            const tflRes = await fetch(tflUrl);
            const tflData = await tflRes.json();

            if (!tflData.stopPoints || tflData.stopPoints.length === 0) {
                return interaction.followUp({
                    content: `🚫 No nearby stations found near **${display_name || locationQuery}**.`
                });
            }

            const nearestStations = tflData.stopPoints
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 3)
                .map(stop => {
                    const miles = (stop.distance / 1609.34).toFixed(2);
                    return `• **${stop.commonName}** — \` ${miles} miles away\``;
                });

            const embed = new EmbedBuilder()
                .setTitle('📍 Nearest Stations')
                .setDescription(`From: **${display_name || locationQuery}**\n\n${nearestStations.join('\n')}`)
                .setColor(0x4caf50)
                .setFooter({ text: 'Data provided by OS Maps & Transport for London' })
                .setTimestamp();

            return interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            return interaction.followUp({
                content: '❌ Failed to fetch station data. Please try again later.'
            });
        }
    }
};
