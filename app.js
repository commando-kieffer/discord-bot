import 'dotenv/config'
import express from 'express'
import {
	InteractionType,
	InteractionResponseType,
	InteractionResponseFlags,
	MessageComponentTypes,
	ButtonStyleTypes,
} from 'discord-interactions'

import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest, hasAccess, ROLE } from './utils.js'

import {
	TEST_COMMAND,
	LINK_COMMAND,
	FIRE_COMMAND,
	ASSIGN_INITIAL_ROLES_COMMAND,
	HasGuildCommands,
	COMMAND_NAMES,
	LINK_MODAL_COMMAND,
	RECRUITMENT_FORM_1_COMMAND,
	RECRUITMENT_FORM_2_COMMAND,
	RECRUITMENT_FORM_3_COMMAND,
	HELP_COMMAND,
	INFOS_GENERALES_COMMAND,
	INFOS_SITES_COMMAND,
	INFOS_SPE_COMMAND,
	CIVILS_NON_VUS_COMMAND,
	START_RECRUITMENT_COMMAND,
  	PROFILE_COMMAND,
	GET_USERNAME_COMMAND,
	COMPLAINT_COMMAND
} from './commands/index.js'

import {
	linkCommando,
	assignInitialRoles,
	fireCommando,
	recruitmentForm1,
	recruitmentForm2,
	recruitmentForm3,
	help,
	displayWebsites,
	displaySpe,
	displayGeneralInfos,
	displayUnseenCivilians,
	startRecruitment,
  	getProfile,
	getUsername,
	sendComplaint
} from './logic.js'

import {
	Fields,
	RECRUITMENT_FORM_1,
	RECRUITMENT_FORM_1_ID,
	RECRUITMENT_FORM_2,
	RECRUITMENT_FORM_2_ID,
	RECRUITMENT_FORM_3,
	RECRUITMENT_FORM_3_ID,
} from './recruitment-forms.js'

import { COMPLAINT_FORM, COMPLAINT_FORM_ID } from './complaint-form.js'

import { forumService } from './services/forum/index.js'

const app = express()
const PORT = process.env.PORT || 3000
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }))

app.get('/redirect', async function (req, res) {
	console.log(req)
	res.status(200).send({})
})

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
	const { type, id, data } = req.body

	if (type === InteractionType.PING) {
		return res.send({ type: InteractionResponseType.PONG })
	}

	if (type === InteractionType.MODAL_SUBMIT) {
		const modalId = data.custom_id
		const userId = req.body.member.user.id

		if (modalId === RECRUITMENT_FORM_1_ID) {
			const { username } = req.body.member.user
			const formData = {
				[Fields.DISCORD_ID]: userId,
				[Fields.DISCORD_USERNAME]: username,
			}

			for (const action of data.components) {
				const { custom_id, value } = action.components[0]
				formData[custom_id] = value
			}

			recruitmentForm1(userId, formData).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}

		if (modalId === RECRUITMENT_FORM_2_ID) {
			const formData = {}

			for (const action of data.components) {
				const { custom_id, value } = action.components[0]
				formData[custom_id] = value
			}

			recruitmentForm2(userId, formData).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}

		if (modalId === RECRUITMENT_FORM_3_ID) {
			const formData = {}

			for (const action of data.components) {
				const { custom_id, value } = action.components[0]
				formData[custom_id] = value
			}

			recruitmentForm3(userId, formData).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}

		if (modalId === COMPLAINT_FORM_ID) {
			const complaint = data.components[0].components[0].value

			sendComplaint(userId, complaint).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: '',
					},
				})
			)
		}

		if (modalId.startsWith('link-form-')) {
			const userToLink = modalId.replace('link-form-', '')
			const component = data.components[0].components[0]

			linkCommando(userId, [userToLink, component.value]).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}
	}

	/**
	 * REQUETES AVEC UNE COMMANDE OU UNE ACTION SUR UN COMMANDO
	 */
	if (type === InteractionType.APPLICATION_COMMAND) {
		const { name } = data

		if (name === COMMAND_NAMES.TEST) {
			return res.send({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: '**Bonjour**,\nje suis le BOT du commando Kieffer ' + getRandomEmoji(),
				},
			})
		}

		if (name === COMMAND_NAMES.HELP) {
			return help().then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: { content: message },
				})
			)
		}

		if (name === COMMAND_NAMES.INFOS_GENERALES) {
			return displayGeneralInfos().then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: { content: message },
				})
			)
		}

		if (name === COMMAND_NAMES.INFOS_SITES) {
			return displayWebsites().then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: { content: message },
				})
			)
		}

		if (name === COMMAND_NAMES.INFOS_SPE) {
			return displaySpe().then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: { content: message },
				})
			)
		}

		if (name === COMMAND_NAMES.PROFILE) {
			const userId = req.body.member.user.id
			return getProfile(userId).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: { content: message },
					// data: { content: "Bon ça suffit oui ?" },
				})
			)
		}

		if (name == COMMAND_NAMES.GET_USERNAME) {
			const { user, roles } = req.body.member
			const targetUser = data.target_id


			if (!hasAccess(ROLE.ALL, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'avez pas la permission d'éxécuter cette commande.",
					},
				})

			getUsername(user.id, targetUser).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			).catch(err => { console.log('Error:', err) })
		}

		if (name === COMMAND_NAMES.LINK) {
			const userId = req.body.member.user.id
			const { roles } = req.body.member
			const values = data.options.map((x) => x.value)

			if (!hasAccess(ROLE.INSTRUCTEURS, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						// Fetches a random emoji to send from a helper function
						content: "Vous n'avez pas les autorisations nécessaires",
					},
				})

			linkCommando(userId, values).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}

		if (name === COMMAND_NAMES.START_RECRUITMENT) {
			const { user, roles } = req.body.member
			const userToRecruit = data.target_id

			if (!hasAccess(ROLE.INSTRUCTEURS, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'avez pas la permission d'éxécuter cette commande.",
					},
				})

			startRecruitment(user.id, userToRecruit).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}

		if (name === COMMAND_NAMES.CIVILS_NON_VUS) {
			const { roles } = req.body.member

			if (!hasAccess(ROLE.INSTRUCTEURS, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'avez pas la permission d'exécuter cette commande",
					},
				})

			displayUnseenCivilians().then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}

		if (name === COMMAND_NAMES.FIRE) {
			const userId = req.body.member.user.id
			const { roles } = req.body.member
			const userToFire = data.target_id

			if (!hasAccess(ROLE.EM, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'êtes pas membre de l'État-Major",
					},
				})

			fireCommando(userId, userToFire).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}

		if (name == COMMAND_NAMES.COMPLAINT) {
			const { user, roles } = req.body.member

			if (!hasAccess(ROLE.ALL, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'avez pas les autorisations nécessaires",
					},
				})
			
			return res.send({
				type: InteractionResponseType.MODAL,
				data: COMPLAINT_FORM,
			})

		}

		if (name === COMMAND_NAMES.LINK_MODAL) {
			const { roles } = req.body.member
			const userToLink = data.target_id

			if (!hasAccess(ROLE.INSTRUCTEURS, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'avez pas les autorisations nécessaires",
					},
				})

			const lastUsers = await forumService.users.last()

			return res.send({
				type: InteractionResponseType.MODAL,
				data: {
					// user_to_link: userToLink,
					custom_id: 'link-form-' + userToLink,
					title: 'Lien entre compte Discord et Forum',
					components: [
						{
							type: MessageComponentTypes.ACTION_ROW,
							components: [
								{
									type: MessageComponentTypes.INPUT_TEXT,
									custom_id: 'forum-id',
									style: 1,
									label: 'Identifiant (ID) forum',
									required: true,
									min_length: 1,
									max_length: 5,
								},
							],
						},
						{
							type: MessageComponentTypes.ACTION_ROW,
							components: [
								{
									type: MessageComponentTypes.INPUT_TEXT,
									custom_id: 'last-users',
									style: 2,
									label: 'Derniers utilisateurs',
									required: false,
									value: lastUsers
										.map(
											({ user_id, username }) =>
												`NOM = "${username}", ID = ${user_id}`
										)
										.join('\n'),
								},
							],
						},
					],
				},
			})
		}

		if (name === COMMAND_NAMES.ASSIGN_INITIAL_ROLES) {
			const userId = req.body.member.user.id

			assignInitialRoles(
				userId,
				data.options.map((x) => x.value)
			).then(({ status, message }) =>
				res.status(status).send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: message,
					},
				})
			)
		}

		if (name === COMMAND_NAMES.RECRUITMENT_FORM_1) {
			const { roles } = req.body.member

			if (!hasAccess(ROLE.RECRUIT, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'avez pas la permission d'éxécuter cette commande.",
					},
				})

			res.send({
				type: InteractionResponseType.MODAL,
				data: RECRUITMENT_FORM_1,
			})
		}

		if (name === COMMAND_NAMES.RECRUITMENT_FORM_2) {
			const { roles } = req.body.member

			if (!hasAccess(ROLE.RECRUIT, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'avez pas la permission d'éxécuter cette commande.",
					},
				})

			return res.send({
				type: InteractionResponseType.MODAL,
				data: RECRUITMENT_FORM_2,
			})
		}

		if (name === COMMAND_NAMES.RECRUITMENT_FORM_3) {
			const { roles } = req.body.member

			if (!hasAccess(ROLE.RECRUIT, roles))
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Vous n'avez pas la permission d'éxécuter cette commande.",
					},
				})

			return res.send({
				type: InteractionResponseType.MODAL,
				data: RECRUITMENT_FORM_3,
			})
		}
	}
})

app.listen(PORT, () => {
	console.log('Listening on port', PORT)

	HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
		TEST_COMMAND,
		HELP_COMMAND,
		// LINK_COMMAND,
		LINK_MODAL_COMMAND,
		// INFOS_GENERALES_COMMAND,
		INFOS_SITES_COMMAND,
		INFOS_SPE_COMMAND,
		CIVILS_NON_VUS_COMMAND,
		ASSIGN_INITIAL_ROLES_COMMAND,
		FIRE_COMMAND,
		START_RECRUITMENT_COMMAND,
		RECRUITMENT_FORM_1_COMMAND,
		RECRUITMENT_FORM_2_COMMAND,
		RECRUITMENT_FORM_3_COMMAND,
    	PROFILE_COMMAND,
		GET_USERNAME_COMMAND,
		COMPLAINT_COMMAND
	])
})
