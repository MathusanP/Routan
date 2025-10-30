const { SlashCommandBuilder, EmbedBuilder, polyfillDispose } = require('discord.js');
const mysql = require('mysql2');
require('dotenv').config({ path: 'secrets.env' });


module.exports = {
    name: 'favstop',
    description: 'Fetches your marked favourite bus stop.',
    usage: '',

    permissions: [],
    ownerOnly: false,
    guildOnly: true,

    data: new SlashCommandBuilder()
        .setName('favstop')
        .setDescription('Shows the latency for the bot!'),

    error: false,
    execute: async ({ interaction, client }) => {

        const pool = mysql.createPool({
            host: process.env.dbHost,
            user: process.env.dbUser,
            password: process.env.dbPassword,
            database: process.env.db,
            waitForConnections: true,
            connectionLimit: 10,
            idleTimeout: 60000,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,

        })

        const userId = interaction.user.id;

        function fetchFav(userId) {
            return new Promise((resolve, reject) => {
                pool.query(`SELECT stopId FROM userFavourites WHERE uid = ?`, [userId], (err, results) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });
        }


        const results = await fetchFav(userId);
        if (!results) {
            return interaction.followUp('It seems you do not have a favourite bus stop.')
        }

        const stopId = results[0].stopId

        const arrivalsRes = await fetch(`https://api.tfl.gov.uk/StopPoint/${stopId}/Arrivals?app_key=${process.env.tflapi}`);
        const arrivals = await arrivalsRes.json();

        if (!arrivals.length) {
            return interaction.editReply({
                content: '🚫 No upcoming buses at this stop.',
                components: []
            });
        }
        // Fetching requested bus stop details.
        const sortedArrivals = arrivals
            .sort((a, b) => a.timeToStation - b.timeToStation)
            .slice(0, 5)
            .map(bus => `• **${bus.lineName}** to *${bus.destinationName}* — arriving in **${Math.round(bus.timeToStation / 60)} min**`);

        const stopLetter = arrivals?.stopLetter || arrivals?.indicator?.replace(/^Stop\s+/i, "") || null;
        const stopName = arrivals?.commonName || arrivals[0].stationName;


        // Creating the embed
        const embed = new EmbedBuilder()
            .setTitle(stopLetter
                ? `🚌 Next buses at ${stopName} (${stopLetter})`
                : `🚌 Next buses at ${stopName}`)
            .setDescription(sortedArrivals.join('\n'))
            .setColor(0x4caf50)
            .setFooter({ text: 'Data provided by TFL and OS Maps.' })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed]
        });




    },
};