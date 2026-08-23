import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';

export default {
    data: new SlashCommandBuilder()
        .setName("rename")
        .setDescription("Renames the current ticket channel.")
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName("name")
                .setDescription("The new name for the ticket channel.")
                .setRequired(true)
        ),

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'This command can only be used in a valid ticket channel.' });
        }

        if (!permissionContext.canManageTicket) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need staff management permissions to rename tickets.' });
        }

        const newName = interaction.options.getString("name").toLowerCase().replace(/\s+/g, '-');
        const oldName = interaction.channel.name;

        try {
            await interaction.channel.setName(newName);
            
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed("Ticket Renamed", `Channel successfully renamed from **${oldName}** to **${newName}**.`)]
            });

            logger.info('Ticket channel renamed', {
                channelId: interaction.channel.id,
                oldName,
                newName,
                userId: interaction.user.id
            });
        } catch (error) {
            logger.error('Failed to rename ticket channel', { error: error.message });
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to rename the channel. Ensure the bot has adequate permissions or check Discord rate limits.' });
        }
    },
};
