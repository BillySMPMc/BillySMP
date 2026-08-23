import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { claimTicket } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("claim")
        .setDescription("Claims an open ticket and assigns it to you.")
        .setDMPermission(false),

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'This command can only be used inside a valid ticket channel.' });
        }

        if (!permissionContext.canManageTicket) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You lack permissions or the required staff role to claim this ticket.' });
        }

        // Execute claim service logic
        await claimTicket(interaction.channel, interaction.user);

        // Optional: Update channel topic to show assigned staff member
        try {
            await interaction.channel.setTopic(`Claimed by: ${interaction.user.tag} (${interaction.user.id}) | Type: ${permissionContext.ticketData.type || 'Support'}`);
        } catch (e) {
            // Ignore if missing permissions to set topic
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed("Ticket Claimed", `You have successfully claimed this ticket. User correspondence is now tracked under your profile.`)]
        });

        // Broadcast claim message inside channel publicly
        await interaction.channel.send({
            embeds: [successEmbed("Ticket Assigned", `🔒 This ticket has been claimed by **${interaction.user}**.`)]
        });

        logger.info('Ticket claimed successfully', { userId: interaction.user.id, channelId: interaction.channel.id });
    },
};
