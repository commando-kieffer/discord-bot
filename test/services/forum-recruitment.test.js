import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { XenforoApiError } from '../../src/clients/xenforo.js'
import { Fields } from '../../src/forms/recruitment-forms.js'
import { ForumError } from '../../src/services/forum/errors.js'
import {
	RECRUITMENT_NODE_ID,
	RECRUITMENT_PREFIX_ID,
	buildMessage,
	createRecruitmentRepository,
} from '../../src/services/forum/recruitment.js'
import { createFakeDb, createTestLogger, ids, sqlError } from '../support/fakes.js'

const NOW = new Date('2026-11-03T12:00:00.000Z')

const setup = (script, xenforo = {}) => {
	const db = createFakeDb(script)
	const logger = createTestLogger()
	const calls = []
	const fakeXenforo = {
		createThread: async (payload) => {
			calls.push(payload)
			if (xenforo.error) throw xenforo.error
			return xenforo.thread ?? { thread_id: 321, user_id: 7526, view_url: 'https://forum/threads/321/' }
		},
	}
	const repo = createRecruitmentRepository({ db, xenforo: fakeXenforo, logger, game: 'Arma Reforger', now: () => NOW })
	return { db, logger, repo, threads: calls }
}

const rejectsWith = (promise, message) =>
	assert.rejects(promise, (err) => {
		assert.ok(err instanceof ForumError, `ForumError attendue, reçu ${err}`)
		assert.equal(err.message, message)
		return true
	})

const FORUM_INFO = /FROM xf_user as u[\s\S]*INNER JOIN xf_user_profile/
const IN_PROGRESS = /SELECT id FROM infos_recrutement WHERE user_id = \? AND form3_complete = 0/
const INSERT = /INSERT INTO infos_recrutement/
const userInfo = { user_id: 7526, username: 'MoziSkync', dob_day: 1, dob_month: 2, dob_year: 2000 }

const form1 = {
	[Fields.DISCORD_ID]: ids.requester,
	[Fields.DISCORD_USERNAME]: 'mozi',
	[Fields.COMMANDO_NAME]: 'Kieffer',
	[Fields.GAME_STYLE]: 'Fusil',
	[Fields.MAIN_PLATFORM]: 'PC',
	[Fields.PLATFORM_USERNAME]: 'Mozi#1234',
	[Fields.FIRSTNAME]: 'Jean',
}

describe('questionnaire 1/3', () => {
	it('crée la fiche de recrutement à partir du compte forum lié', async () => {
		const { db, repo } = setup([
			[FORUM_INFO, [userInfo]],
			[IN_PROGRESS, []],
			[INSERT, { affectedRows: 1 }],
		])

		assert.equal(await repo.part1(ids.requester, form1), `<@${ids.requester}>, formulaire 1/3 complété.`)
		assert.deepEqual(db.calls[0].params, [ids.requester])
		assert.deepEqual(db.calls[1].params, [7526])
		assert.deepEqual(db.calls[2].params, [7526, 'mozi', 'MoziSkync', 'Kieffer', '1/2/2000', 'Fusil', 'PC', 'Mozi#1234', 'Jean'])
	})

	it('refuse un compte Discord non lié au forum', async () => {
		const message = "Une erreur est survenue. Peut-être que votre compte Discord n'est pas lié au forum. CODE R40"
		await rejectsWith(setup([[FORUM_INFO, []]]).repo.part1(ids.requester, form1), message)
		await rejectsWith(setup([[FORUM_INFO, sqlError('ER_PARSE_ERROR')]]).repo.part1(ids.requester, form1), message)
	})

	it('signale une base injoignable', async () => {
		await rejectsWith(
			setup([[FORUM_INFO, sqlError('ECONNREFUSED')]]).repo.part1(ids.requester, form1),
			'Erreur de connexion à la base de données. CODE R33'
		)
	})

	it('refuse un second envoi tant que la fiche en cours n\'est pas terminée', async () => {
		const { db, repo } = setup([
			[FORUM_INFO, [userInfo]],
			[IN_PROGRESS, [{ id: 12 }]],
		])
		await rejectsWith(repo.part1(ids.requester, form1), `<@${ids.requester}>, vous avez déjà rempli le formulaire 1/3. Passez au formulaire 2/3.`)
		assert.equal(db.calls.length, 2)
	})

	it('signale une insertion en échec sans montrer l\'erreur SQL', async () => {
		const { repo, logger } = setup([
			[FORUM_INFO, [userInfo]],
			[IN_PROGRESS, []],
			[INSERT, sqlError('ER_DATA_TOO_LONG', "Data too long for column 'first_name'")],
		])
		await rejectsWith(repo.part1(ids.requester, form1), 'Une erreur est survenue. CODE R74')
		assert.match(logger.entries.at(-1).context.error.message, /first_name/)

		const empty = setup([
			[FORUM_INFO, [userInfo]],
			[IN_PROGRESS, []],
			[INSERT, { affectedRows: 0 }],
		])
		await rejectsWith(empty.repo.part1(ids.requester, form1), 'Une erreur est survenue. CODE R79')
	})
})

describe('questionnaire 2/3', () => {
	const form2 = {
		[Fields.CAN_BE_PRESENT]: 'O',
		[Fields.CAN_PAY]: 'n',
		[Fields.HOW_KNOW_US]: 'Un ami',
		[Fields.COMMENT]: '',
	}

	it('complète la fiche en cours', async () => {
		const { db, repo } = setup([[/UPDATE infos_recrutement[\s\S]*form2_complete = 1/, { affectedRows: 1, changedRows: 1 }]])
		assert.equal(await repo.part2(ids.requester, form2), `<@${ids.requester}>, formulaire 2/3 complété.`)
		assert.deepEqual(db.calls[0].params, [1, 0, 'Un ami', '', ids.requester])
		assert.match(db.calls[0].sql, /form1_complete = 1 AND\s+form2_complete = 0 AND\s+form3_complete = 0/)
	})

	it('refuse si le formulaire a déjà été rempli', async () => {
		await rejectsWith(
			setup([[/UPDATE/, { affectedRows: 0, changedRows: 0 }]]).repo.part2(ids.requester, form2),
			"L'opération ne peut pas être complétée. Le formulaire a certainement déjà été rempli. CODE R126"
		)
	})

	it('signale les erreurs SQL', async () => {
		await rejectsWith(setup([[/UPDATE/, sqlError('ER_X')]]).repo.part2('1', form2), 'Une erreur est survenue. CODE R120')
		await rejectsWith(setup([[/UPDATE/, sqlError('ECONNREFUSED')]]).repo.part2('1', form2), 'Erreur de connexion à la base de données')
	})
})

describe('questionnaire 3/3', () => {
	const form3 = { [Fields.SKILLS_DEV]: 'o', [Fields.SKILLS_DESIGN]: 'N', [Fields.SKILLS_VIDEO]: 'O' }
	const UPDATE3 = /UPDATE infos_recrutement[\s\S]*form3_complete = 1/
	const RECORD = /SELECT u.user_id as userId, r\.\*[\s\S]*ORDER BY r.id DESC/
	const SAVE = /UPDATE infos_recrutement SET post_id = \? WHERE id = \?/
	const REOPEN = /SET form3_complete = 0 WHERE user_id = \([\s\S]*\) AND post_id IS NULL/
	const record = {
		id: 55,
		userId: 7526,
		commando_name: 'Kieffer',
		first_name: 'Jean',
		skills_dev: 1,
		skills_design: 0,
		skills_video: 1,
		can_be_present: 1,
		can_pay: 1,
	}

	it('termine la fiche, la poste sur le forum au nom de la recrue et garde le lien vers le sujet', async () => {
		const { db, repo, threads } = setup([
			[UPDATE3, { affectedRows: 1, changedRows: 1 }],
			[RECORD, [record]],
			[SAVE, { affectedRows: 1, changedRows: 1 }],
		])

		const message = await repo.part3(ids.requester, form3)

		assert.equal(
			message,
			`<@${ids.requester}>, formulaire 3/3 complété.\nVotre fiche a été postée.\nVous pouvez la consulter à cette adresse : https://forum/threads/321/`
		)
		assert.deepEqual(db.calls[0].params, [1, 0, 1, ids.requester])
		assert.deepEqual(db.calls[1].params, [ids.requester])
		assert.deepEqual(db.calls[2].params, [321, 55])

		const [thread] = threads
		assert.equal(thread.asUser, 7526)
		assert.equal(thread.node_id, RECRUITMENT_NODE_ID)
		assert.equal(thread.prefix_id, RECRUITMENT_PREFIX_ID)
		assert.equal(thread.discussion_type, 'discussion')
		assert.equal(thread.sticky, false)
		assert.equal(thread.discussion_open, true)
		assert.equal(thread.title, '[KIEFFER - EN FORMATION]')
		assert.equal(thread.message, buildMessage(record, { game: 'Arma Reforger', date: NOW }))
	})

	it('refuse si le formulaire a déjà été rempli', async () => {
		await rejectsWith(
			setup([[UPDATE3, { affectedRows: 1, changedRows: 0 }]]).repo.part3(ids.requester, form3),
			"L'opération ne peut pas être complétée. Le formulaire a certainement déjà été rempli. CODE R176"
		)
		await rejectsWith(setup([[UPDATE3, sqlError('ER_X')]]).repo.part3('1', form3), 'Une erreur est survenue. CODE R170')
	})

	it('rouvre le formulaire si le forum refuse la fiche, pour que la recrue puisse réessayer', async () => {
		const error = new XenforoApiError('Forum POST /threads : HTTP 403 - no_permission', { status: 403 })
		const { db, repo, logger } = setup(
			[
				[UPDATE3, { affectedRows: 1, changedRows: 1 }],
				[RECORD, [record]],
				[REOPEN, { affectedRows: 1 }],
			],
			{ error }
		)

		await rejectsWith(repo.part3(ids.requester, form3), "La fiche n'a pas pu être postée. CODE R307")
		assert.deepEqual(db.calls[2].params, [ids.requester])
		assert.equal(db.remaining, 0)
		const logged = logger.entries.find((entry) => entry.level === 'error')
		assert.equal(logged.context.error, error)
		assert.equal(logged.context.forumUserId, 7526)
	})

	it('rouvre aussi le formulaire si la fiche est introuvable', async () => {
		const { repo, db } = setup([
			[UPDATE3, { affectedRows: 1, changedRows: 1 }],
			[RECORD, []],
			[REOPEN, { affectedRows: 1 }],
		])
		await rejectsWith(repo.part3(ids.requester, form3), "La fiche n'a pas pu être postée. CODE R262")
		assert.equal(db.remaining, 0)
	})

	it('garde l\'erreur d\'origine même si la réouverture échoue', async () => {
		const { repo, logger } = setup(
			[
				[UPDATE3, { affectedRows: 1, changedRows: 1 }],
				[RECORD, [record]],
				[REOPEN, sqlError('ECONNRESET')],
			],
			{ error: new XenforoApiError('x') }
		)
		await rejectsWith(repo.part3(ids.requester, form3), "La fiche n'a pas pu être postée. CODE R307")
		assert.ok(logger.entries.some((entry) => entry.message === 'Impossible de rouvrir le formulaire 3/3'))
	})

	it('signale une fiche postée dont le lien n\'a pas pu être enregistré', async () => {
		const run = (saveResult) =>
			setup([
				[UPDATE3, { affectedRows: 1, changedRows: 1 }],
				[RECORD, [record]],
				[SAVE, saveResult],
			]).repo.part3(ids.requester, form3)

		await rejectsWith(run({ affectedRows: 0, changedRows: 0 }), 'Une erreur est survenue. CODE R204')
		await rejectsWith(run(sqlError('ER_X')), 'Une erreur est survenue. CODE R195')
	})
})

describe('message de la fiche', () => {
	it('contient le jeu, la date d\'arrivée et toutes les réponses', () => {
		const message = buildMessage(
			{
				first_name: 'Jean',
				birthdate: '1/2/2000',
				platform: 'PC',
				pseudo: 'MoziSkync',
				commando_name: 'Kieffer',
				game_style: 'Fusil',
				skills_dev: 1,
				skills_design: 0,
				skills_video: 1,
				discord_username: 'mozi',
				platform_username: 'Mozi#1234',
				can_be_present: 1,
				can_pay: 0,
				how_know_us: 'Un ami',
				comment: 'Rien',
			},
			{ game: 'Arma Reforger', date: NOW }
		)

		assert.match(message, /^\[HEADING=2\]\[u\]QUESTIONNAIRE POUR ARMA REFORGER\[\/u\]\[\/HEADING\]/)
		assert.ok(message.includes(`[b]Date de votre arrivée dans le CK[/b] : ${NOW.toLocaleDateString('fr')}`))
		assert.ok(message.includes('[b]Programmation[/b] : Oui'))
		assert.ok(message.includes('[b]Design[/b] : Non'))
		assert.ok(message.includes('[b]Pouvez vous payer la cotisation annuelle de 10€ ?[/b] : Non'))
		assert.ok(message.includes('[b]Plateforme principale[/b] : Mozi#1234'))
		assert.ok(message.includes('[b]Avez vous un commentaire à formuler ?[/b] : Rien'))
	})
})
