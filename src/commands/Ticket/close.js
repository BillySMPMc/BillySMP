import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { successEmbed, infoEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { closeTicket } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("close")
        .setDescription("Closes the current ticket or requests closure.")
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for closing the ticket.")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName("force")
                .setDescription("Force close immediately without asking the user (Staff only).")
                .setRequired(false)
        ),

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'This command can only be used in a valid ticket channel.' });
        }

        if (!permissionContext.canCloseTicket) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You do not have permission to close this ticket.' });
        }

        const reason = interaction.options.getString("reason") || "No reason provided.";
        const forceClose = interaction.options.getBoolean("force") || false;
        const isStaff = permissionContext.canManageTicket;

        // If staff member runs it without forcing, send a close request prompt to the channel
        if (isStaff && !forceClose) {
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confirm_close_yes').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('confirm_close_no').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [infoEmbed("Close Requested", `A staff member has requested to close this ticket.\n**Reason:** ${reason}\n\nDo you want to proceed?`)]
            });

            const msg = await interaction.channel.send({
                content: `<@${permissionContext.ticketData.userId}>, a staff member has requested closure for your ticket.`,
                components: [confirmRow]
            });

            // Simple collector for confirmation button
            const collector = msg.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async i => {
                if (i.user.id !== permissionContext.ticketData.userId && !i.member.permissions.has('ManageChannels')) {
                    return await i.reply({ content: "You cannot interact with this confirmation.", flags: MessageFlags.Ephemeral });
                }

                if (i.customId === 'confirm_close_yes') {
                    await i.update({ content: "Ticket closure confirmed.", components: [] });
                    await closeTicket(interaction.channel, i.user, reason);
                } else {
                    await i.update({ content: "Ticket closure request cancelled.", components: [] });
                }
            });
            return;
        }

        // Direct closure execution (Force or user closing their own)
        await closeTicket(interaction.channel, interaction.user, reason);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed("Ticket Closed", "This ticket has been closed successfully.")],
        });

        logger.info('Ticket closed', { userId: interaction.user.id, channelId: interaction.channel.id, reason });
    },
};
