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
    execute: ({ interaction, client }) => {

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
            pool.query(`SELECT * FROM userInfo WHERE uid = ${userId}`, function (err, results) {
                if (err) {
                    console.error(err);
                }

                return results

            });
        }

        const results = fetchFav(userId);
        if (!results) {
            return interaction.followUp('It seems you do not have a favourite bus stop.')
        }



    },
};