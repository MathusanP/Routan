const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const proj4 = require('proj4');

// Define British national grid projection
proj4.defs("EPSG:27700",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 " +
  "+x_0=400000 +y_0=-100000 +ellps=airy " +
  "+towgs84=446.448,-125.157,542.06,0.1502,0.247,0.8421,-20.4894 " +
  "+units=m +no_defs"
);

module.exports = {
    name: 'nextbus',
    description: 'Shows the next bus arrivals at a provided bus stop.',
    usage: '/nextbus [location]',

    permissions: [],
    ownerOnly: false,
    guildOnly: true,

    data: new SlashCommandBuilder()
        .setName('nextbus')
        .setDescription('Get next bus arrivals near a location.')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Area or postcode (e.g., Stratford, E15 1AZ)')
                .setRequired(true)
        ),

    error: false,

    execute: async ({ interaction }) => {
        const locationQuery = interaction.options.getString('location');

        try {
            const tflSearchRes = await fetch(`https://api.tfl.gov.uk/StopPoint/Search?query=${encodeURIComponent(locationQuery)}&modes=bus&app_key=${process.env.tflapi}`);
            const tflSearchData = await tflSearchRes.json();

            let lat, lon;

            if (tflSearchData.matches && tflSearchData.matches.length > 0) {
                const matchId = tflSearchData.matches[0].id;
                const stopInfoRes = await fetch(`https://api.tfl.gov.uk/StopPoint/${matchId}?app_key=${process.env.tflapi}`);
                const stopInfo = await stopInfoRes.json();

                if (stopInfo.lat && stopInfo.lon) {
                    lat = stopInfo.lat;
                    lon = stopInfo.lon;
                }
            }

            if (!lat || !lon) {
                const geoRes = await fetch(`https://api.os.uk/search/names/v1/find?query=${encodeURIComponent(locationQuery)}&key=${process.env.osApi}`);
                const geoData = await geoRes.json();
                console.log(geoData);

                if (!geoData.results) {
                    return interaction.editReply({ content: `🚫 Could not find location **${locationQuery}**.` });
                }

                const entry = geoData.results[0].GAZETTEER_ENTRY;
                [lon, lat] = proj4('EPSG:27700', 'EPSG:4326', [entry.GEOMETRY_X, entry.GEOMETRY_Y]);
            }

            const stopsRes = await fetch(`https://api.tfl.gov.uk/StopPoint?lat=${lat}&lon=${lon}&stopTypes=NaptanPublicBusCoachTram&radius=300&app_key=${process.env.tflapi}`);
            const stopsData = await stopsRes.json();

            if (!stopsData.stopPoints || stopsData.stopPoints.length === 0) {
                return interaction.editReply({ content: `🚫 No nearby bus stops found at **${locationQuery}**.` });
            }

            const stopOptions = stopsData.stopPoints
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 5)
                .map(stop => ({
                    label: `${stop.commonName} (${stop.stopLetter || '?'})`,
                    description: `${Math.round(stop.distance)}m away`,
                    value: stop.id
                }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_bus_stop')
                .setPlaceholder('Select a bus stop')
                .addOptions(stopOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.editReply({
                content: `🚌 Select a stop near **${locationQuery}**:`,
                components: [row]
            });

            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_bus_stop',
                time: 15_000,
                max: 1,
            });

            collector.on('collect', async selectInteraction => {
                const stopId = selectInteraction.values[0];

                const arrivalsRes = await fetch(`https://api.tfl.gov.uk/StopPoint/${stopId}/Arrivals?app_key=${process.env.tflapi}`);
                const arrivals = await arrivalsRes.json();

                if (!arrivals.length) {
                    return interaction.editReply({
                        content: '🚫 No upcoming buses at this stop.',
                        components: []
                    });
                }

                const sortedArrivals = arrivals
                    .sort((a, b) => a.timeToStation - b.timeToStation)
                    .slice(0, 5)
                    .map(bus => `• **${bus.lineName}** to *${bus.destinationName}* — arriving in **${Math.round(bus.timeToStation / 60)} min**`);

                const selectedStop = stopsData.stopPoints.find(stop => stop.id === stopId);
                const stopLetter = selectedStop?.stopLetter || selectedStop?.indicator?.replace(/^Stop\s+/i, "") || null;
                const stopName = selectedStop?.commonName || arrivals[0].stationName;

                const embed = new EmbedBuilder()
                    .setTitle(stopLetter
                        ? `🚌 Next buses at ${stopName} (${stopLetter})`
                        : `🚌 Next buses at ${stopName}`)
                    .setDescription(sortedArrivals.join('\n'))
                    .setColor(0x4caf50)
                    .setFooter({ text: 'Data provided by TFL and OS Maps.' })
                    .setTimestamp();

                await interaction.editReply({
                    content: null,
                    embeds: [embed],
                    components: []
                });
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({
                        content: '⌛ Selection timed out. Please try again.',
                        components: []
                    });
                }
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Failed to fetch bus stop data. Please try again later.', components: [] });
        }
    }
};
