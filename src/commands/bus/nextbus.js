const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

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
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`, {
                headers: { 'User-Agent': `bus-times (${process.env.email})` }
            });

            const geoData = await geoRes.json();
            if (!geoData.length) {
                return interaction.editReply({ content: `🚫 Could not find location **${locationQuery}**.` });
            }

            const { lat, lon, display_name } = geoData[0];

            const stopsRes = await fetch(`https://api.tfl.gov.uk/StopPoint?lat=${lat}&lon=${lon}&stopTypes=NaptanPublicBusCoachTram&radius=300&app_key=${process.env.tflapi}`);
            const stopsData = await stopsRes.json();

            if (!stopsData.stopPoints || stopsData.stopPoints.length === 0) {
                return interaction.editReply({ content: `🚫 No nearby bus stops found at **${display_name}**.` });
            }

            const stopOptions = stopsData.stopPoints
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 5)
                .map(stop => ({
                    label: `${stop.commonName} (${stop.stopLetter || "No letter"})`,
                    description: `${Math.round(stop.distance)}m away`,
                    value: stop.id
                }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_bus_stop')
                .setPlaceholder('Select a bus stop')
                .addOptions(stopOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.editReply({
                content: `🚌 Select a stop near **${display_name}**:`,
                components: [row]
            });

            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && i.customId === 'select_bus_stop',
                time: 15_000,
                max: 1,
            });

            collector.on('collect', async selectInteraction => {
                await selectInteraction.deferUpdate();

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

                const embed = new EmbedBuilder()
                    .setTitle(`🚌 Next buses at ${arrivals[0].stationName} (${arrivals[0].stopLetter || "No letter"})`)
                    .setDescription(sortedArrivals.join('\n'))
                    .setColor(0x4caf50)
                    .setFooter({ text: 'Data from TfL' })
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
