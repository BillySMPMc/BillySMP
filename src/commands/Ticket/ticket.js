import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Manages the server's multi-category ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("Sets up the multi-category ticket creation panel.")
                .addChannelOption((option) =>
                    option
                        .setName("panel_channel")
                        .setDescription("The channel where the ticket panel will be sent.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("panel_message")
                        .setDescription("The main message/description for the panel.")
                        .setRequired(false),
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Open the interactive ticket system dashboard"),
        ),
    category: "ticket",

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need `Manage Channels` permission.' });
        }

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "dashboard") {
            return ticketConfig.execute(interaction, config, client);
        }

        if (subcommand === "setup") {
            const panelChannel = interaction.options.getChannel("panel_channel");
            const panelMessage = interaction.options.getString("panel_message") || "Select a ticket category below to open a support request with our dedicated teams.";

            const setupEmbed = createEmbed({ 
                title: "Support Center", 
                description: panelMessage,
                color: getColor('info')
            });

            // 4 Ticket Types mapping roles dynamically
            const ticketMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("create_ticket_select")
                    .setPlaceholder("📌 Choose a ticket category...")
                    .addOptions([
                        {
                            label: "General Support",
                            description: "Get general assistance from our staff team.",
                            value: "general_support",
                            emoji: "💬"
                        },
                        {
                            label: "Staff Reports",
                            description: "Report a staff member confidentially.",
                            value: "staff_reports",
                            emoji: "🛡️"
                        },
                        {
                            label: "Manager Reports",
                            description: "Escalate issues directly to management.",
                            value: "manager_reports",
                            emoji: "👑"
                        },
                        {
                            label: "Tebex / Store Support",
                            description: "Issues regarding store purchases, ranks, or packages.",
                            value: "tebex_support",
                            emoji: "🛒"
                        },
                        {
                            label: "Player Reports",
                            description: "Report a player breaking rules.",
                            value: "player_reports",
                            emoji: "⚖️"
                        }
                    ])
            );

            try {
                const sentPanel = await panelChannel.send({
                    embeds: [setupEmbed],
                    components: [ticketMenu],
                });

                // Save specific role configurations mapping to your provided IDs
                if (client.db && interaction.guildId) {
                    const existingConfig = await getGuildConfig(client, interaction.guildId) || {};
                    existingConfig.ticketPanelChannelId = panelChannel.id;
                    existingConfig.ticketPanelMessageId = sentPanel.id;
                    
                    // Specific role bindings
                    existingConfig.ticketRoles = {
                        general_support: "1541115078320062634",
                        staff_reports: "1540775469765623888",
                        manager_reports: "1540775456490397726",
                        tebex_support: "1540775456490397726",
                        player_reports: "1541115021696966798"
                    };

                    await setGuildConfig(client, interaction.guildId, existingConfig);
                }

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed("Panel Deployed", `Multi-category ticket panel has been set up in ${panelChannel}.`)]
                });

                logger.info('Multi-category ticket panel setup successfully', { guildId: interaction.guildId });
            } catch (error) {
                logger.error('Error setting up multi-category panel', { error: error.message });
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to deploy ticket panel.' });
            }
        }
    }
};
