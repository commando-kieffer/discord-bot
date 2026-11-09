import { InteractionType } from 'discord-interactions'
import { COMMAND_NAMES } from '../commands/definitions.js'
import { COMPLAINT_FORM, COMPLAINT_FORM_ID, Fields as ComplaintFields } from '../forms/complaint-form.js'
import { LINK_FORM_PREFIX, Fields as LinkFields } from '../forms/link-form.js'
import { CADET_FORM_PREFIX, ENROL_FORM_PREFIX, readRankForm } from '../forms/rank-form.js'
import {
	Fields as RecruitmentFields,
	RECRUITMENT_FORM_1,
	RECRUITMENT_FORM_1_ID,
	RECRUITMENT_FORM_2,
	RECRUITMENT_FORM_2_ID,
	RECRUITMENT_FORM_3,
	RECRUITMENT_FORM_3_ID,
} from '../forms/recruitment-forms.js'
import { ROLE, hasAccess } from '../security/access.js'
import { isSnowflake } from '../security/validation.js'
import { GENERIC_ERROR_MESSAGE } from '../services/forum/errors.js'
import { readModalValues } from './modal.js'
import { modal, pong, privateReply, reply } from './responses.js'

export const NOT_ON_SERVER_MESSAGE = 'Les commandes du bot ne fonctionnent que sur le serveur Discord du CK.'
export const UNKNOWN_MEMBER_MESSAGE = 'Membre introuvable.'

const NO_PERMISSION = "Vous n'avez pas la permission d'éxécuter cette commande."
const NO_AUTHORIZATION = "Vous n'avez pas les autorisations nécessaires"

const respond = (body, status = 200) => ({ status, body })
const fromResult = ({ status, message }) => respond(reply(message), status)

// Le formulaire à afficher, ou le message qui explique pourquoi il ne s'ouvre pas
const fromOpenForm = (result) => (result.form ? respond(modal(result.form)) : fromResult(result))

// Valeurs des options d'une commande slash, par nom
const readOptions = (data) => Object.fromEntries((data.options ?? []).map(({ name, value }) => [name, value]))

// Membre ciblé par une action, tel que Discord le joint à l'interaction (rôles, pseudo, nom d'utilisateur)
const targetMember = (ctx) => ({
	...ctx.data.resolved?.members?.[ctx.targetId],
	user: ctx.data.resolved?.users?.[ctx.targetId],
})

/**
 * REQUETES AVEC UNE COMMANDE OU UNE ACTION SUR UN COMMANDO
 */
const buildCommands = ({ config, features }) => {
	const { members, recruitment, profile, info, complaints, fun } = features

	return {
		[COMMAND_NAMES.TEST]: {
			run: () => respond(reply('**Bonjour**,\nje suis le BOT du commando Kieffer ' + fun.getRandomEmoji())),
		},

		[COMMAND_NAMES.COIN_FLIP]: {
			run: async () => {
				const { status, message, picture } = await fun.coinFlip()
				const embeds = [{ image: { url: `${config.publicUrl}/public/pictures/${picture}` } }]
				return respond(reply(message, { embeds }), status)
			},
		},

		[COMMAND_NAMES.HELP]: { run: async () => fromResult(await info.help()) },
		[COMMAND_NAMES.INFOS_GENERALES]: { run: async () => fromResult(await info.displayGeneralInfos()) },
		[COMMAND_NAMES.INFOS_SITES]: { run: async () => fromResult(await info.displayWebsites()) },
		[COMMAND_NAMES.INFOS_SPE]: { run: async () => fromResult(await info.displaySpe()) },

		[COMMAND_NAMES.PROFILE]: {
			// data: { content: "Bon ça suffit oui ?" },
			run: async (ctx) => fromResult(await profile.getProfile(ctx.userId)),
		},

		[COMMAND_NAMES.GET_USERNAME]: {
			access: ROLE.ALL,
			denied: NO_PERMISSION,
			target: true,
			run: async (ctx) => fromResult(await profile.getUsername(ctx.userId, ctx.targetId)),
		},

		[COMMAND_NAMES.LINK]: {
			access: ROLE.INSTRUCTEURS,
			// Fetches a random emoji to send from a helper function
			denied: NO_AUTHORIZATION,
			run: async (ctx) => {
				const options = readOptions(ctx.data)
				return fromResult(await members.linkCommando(ctx.userId, [options.commando, options['id-forum']]))
			},
		},

		[COMMAND_NAMES.CIVILS_NON_VUS]: {
			access: ROLE.INSTRUCTEURS,
			denied: "Vous n'avez pas la permission d'exécuter cette commande",
			run: async () => fromResult(await members.displayUnseenCivilians()),
		},

		[COMMAND_NAMES.FIRE]: {
			access: ROLE.EM,
			denied: "Vous n'êtes pas membre de l'État-Major",
			target: true,
			run: async (ctx) => fromResult(await members.fireCommando(ctx.userId, ctx.targetId)),
		},

		[COMMAND_NAMES.COMPLAINT]: {
			access: ROLE.ALL,
			denied: NO_AUTHORIZATION,
			run: () => respond(modal(COMPLAINT_FORM)),
		},

		[COMMAND_NAMES.LINK_MODAL]: {
			access: ROLE.INSTRUCTEURS,
			denied: NO_AUTHORIZATION,
			target: true,
			run: async (ctx) => fromOpenForm(await members.openLinkForm(ctx.userId, ctx.targetId, targetMember(ctx))),
		},

		[COMMAND_NAMES.ENROL]: {
			access: ROLE.INSTRUCTEURS,
			denied: NO_PERMISSION,
			target: true,
			run: (ctx) => fromOpenForm(recruitment.openEnrolForm(ctx.userId, ctx.targetId, targetMember(ctx))),
		},

		[COMMAND_NAMES.ASSIGN_INITIAL_ROLES]: {
			access: ROLE.INSTRUCTEURS,
			denied: NO_PERMISSION,
			target: true,
			run: (ctx) => fromOpenForm(recruitment.openCadetForm(ctx.userId, ctx.targetId, targetMember(ctx))),
		},

		[COMMAND_NAMES.RECRUITMENT_FORM_1]: {
			access: ROLE.RECRUIT,
			denied: NO_PERMISSION,
			run: () => respond(modal(RECRUITMENT_FORM_1)),
		},

		[COMMAND_NAMES.RECRUITMENT_FORM_2]: {
			access: ROLE.RECRUIT,
			denied: NO_PERMISSION,
			run: () => respond(modal(RECRUITMENT_FORM_2)),
		},

		[COMMAND_NAMES.RECRUITMENT_FORM_3]: {
			access: ROLE.RECRUIT,
			denied: NO_PERMISSION,
			run: () => respond(modal(RECRUITMENT_FORM_3)),
		},
	}
}

// Formulaires envoyés. Les droits sont vérifiés à nouveau ici : on ne se fie pas au fait que le formulaire
// n'a pu être ouvert que par quelqu'un d'autorisé.
const buildForms = ({ features }) => {
	const { members, recruitment, complaints } = features

	return [
		{
			id: RECRUITMENT_FORM_1_ID,
			access: ROLE.RECRUIT,
			denied: NO_PERMISSION,
			run: async (ctx, values) =>
				fromResult(
					await recruitment.recruitmentForm1(ctx.userId, {
						...values,
						[RecruitmentFields.DISCORD_ID]: ctx.userId,
						[RecruitmentFields.DISCORD_USERNAME]: ctx.member.user.username,
					})
				),
		},
		{
			id: RECRUITMENT_FORM_2_ID,
			access: ROLE.RECRUIT,
			denied: NO_PERMISSION,
			run: async (ctx, values) => fromResult(await recruitment.recruitmentForm2(ctx.userId, values)),
		},
		{
			id: RECRUITMENT_FORM_3_ID,
			access: ROLE.RECRUIT,
			denied: NO_PERMISSION,
			run: async (ctx, values) => fromResult(await recruitment.recruitmentForm3(ctx.userId, values)),
		},
		{
			id: COMPLAINT_FORM_ID,
			run: async (ctx, values) => {
				const { status, message } = await complaints.sendComplaint(ctx.userId, values[ComplaintFields.MESSAGE])
				return respond(privateReply(message), status)
			},
		},
		{
			prefix: LINK_FORM_PREFIX,
			access: ROLE.INSTRUCTEURS,
			denied: NO_AUTHORIZATION,
			run: async (ctx, values, userToLink) =>
				fromResult(await members.linkAndStartRecruitment(ctx.userId, userToLink, values[LinkFields.FORUM_ID])),
		},
		{
			prefix: ENROL_FORM_PREFIX,
			access: ROLE.INSTRUCTEURS,
			denied: NO_PERMISSION,
			run: async (ctx, values, commando) => {
				const { nom, troop, bordee } = readRankForm(values)
				return fromResult(await recruitment.enrolRecruit(ctx.userId, [commando, nom, troop, bordee]))
			},
		},
		{
			prefix: CADET_FORM_PREFIX,
			access: ROLE.INSTRUCTEURS,
			denied: NO_PERMISSION,
			run: async (ctx, values, commando) => {
				const { nom, troop, bordee } = readRankForm(values)
				return fromResult(await recruitment.assignInitialRoles(ctx.userId, [commando, nom, troop, bordee]))
			},
		},
	]
}

export function createInteractionHandler({ config, features, logger }) {
	const commands = buildCommands({ config, features })
	const forms = buildForms({ features })

	const isAllowed = (entry, ctx, what) => {
		if (hasAccess(entry.access ?? ROLE.ALL, ctx.roles, config.roles)) return true
		logger.warn('Accès refusé', { what, userId: ctx.userId })
		return false
	}

	async function runCommand(ctx) {
		const command = commands[ctx.data.name]
		if (!command) {
			logger.warn('Commande inconnue', { name: ctx.data.name, userId: ctx.userId })
			return respond(reply("Cette commande n'existe plus."))
		}

		if (!isAllowed(command, ctx, ctx.data.name)) return respond(reply(command.denied))

		if (command.target) {
			if (!isSnowflake(ctx.data.target_id)) return respond(reply(UNKNOWN_MEMBER_MESSAGE))
			ctx.targetId = ctx.data.target_id
		}

		return command.run(ctx)
	}

	async function runForm(ctx) {
		const customId = String(ctx.data.custom_id ?? '')
		const form = forms.find((entry) => (entry.id ? entry.id === customId : customId.startsWith(entry.prefix)))
		if (!form) {
			logger.warn('Formulaire inconnu', { customId, userId: ctx.userId })
			return respond(reply("Ce formulaire n'existe plus."))
		}

		if (!isAllowed(form, ctx, customId)) return respond(reply(form.denied))

		// Pour les formulaires liés à un membre, son identifiant est à la fin du custom_id
		let targetId
		if (form.prefix) {
			targetId = customId.slice(form.prefix.length)
			if (!isSnowflake(targetId)) return respond(reply(UNKNOWN_MEMBER_MESSAGE))
		}

		return form.run(ctx, readModalValues(ctx.data.components), targetId)
	}

	return async function handleInteraction(body) {
		const { type, data } = body ?? {}

		if (type === InteractionType.PING) return respond(pong())

		if (type !== InteractionType.APPLICATION_COMMAND && type !== InteractionType.MODAL_SUBMIT) {
			logger.warn("Type d'interaction non géré", { type })
			return respond({ error: 'unsupported interaction type' }, 400)
		}

		// Les commandes sont globales : on ignore celles lancées en message privé ou depuis un autre serveur
		const userId = body.member?.user?.id
		if (!userId || body.guild_id !== config.discord.guildId) {
			logger.warn('Interaction reçue hors du serveur du CK', {
				guildId: body.guild_id ?? null,
				userId: userId ?? body.user?.id ?? null,
			})
			return respond(reply(NOT_ON_SERVER_MESSAGE))
		}

		const ctx = { data: data ?? {}, member: body.member, userId, roles: body.member.roles ?? [] }
		const isCommand = type === InteractionType.APPLICATION_COMMAND

		try {
			return isCommand ? await runCommand(ctx) : await runForm(ctx)
		} catch (err) {
			logger.error(isCommand ? `Commande "${ctx.data.name}" en échec` : `Formulaire "${ctx.data.custom_id}" en échec`, {
				userId,
				error: err,
			})
			return respond(reply(GENERIC_ERROR_MESSAGE))
		}
	}
}
