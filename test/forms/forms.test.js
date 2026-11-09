import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MessageComponentTypes } from 'discord-interactions'
import { COMPLAINT_FORM } from '../../src/forms/complaint-form.js'
import { LINK_FORM_PREFIX, buildLinkForm } from '../../src/forms/link-form.js'
import {
	CADET_FORM_PREFIX,
	ENROL_FORM_PREFIX,
	Fields,
	LABEL,
	buildCadetForm,
	buildEnrolForm,
	readRankForm,
} from '../../src/forms/rank-form.js'
import { RECRUITMENT_FORM_1, RECRUITMENT_FORM_2, RECRUITMENT_FORM_3 } from '../../src/forms/recruitment-forms.js'
import { ids } from '../support/fakes.js'

// Règles de Discord sur les formulaires : 45 caractères de titre, 5 composants au plus
const assertValidModal = (form) => {
	assert.ok(form.custom_id.length >= 1 && form.custom_id.length <= 100, form.custom_id)
	assert.ok(form.title.length >= 1 && form.title.length <= 45, form.title)
	assert.ok(form.components.length >= 1 && form.components.length <= 5)
}

describe('formulaires Enrôler (recrue) et Recruter (cadet)', () => {
	it('demandent le nom, la troop et la bordée dans des labels', () => {
		const form = buildEnrolForm(ids.target)
		assertValidModal(form)
		assert.equal(form.custom_id, ENROL_FORM_PREFIX + ids.target)
		assert.equal(form.title, 'Enrôler en recrue')
		assert.deepEqual(
			form.components.map((row) => [row.type, row.label, row.component.type, row.component.custom_id]),
			[
				[LABEL, 'Nom de commando', MessageComponentTypes.INPUT_TEXT, Fields.COMMANDO_NAME],
				[LABEL, 'Troop', MessageComponentTypes.STRING_SELECT, Fields.TROOP],
				[LABEL, 'Bordée', MessageComponentTypes.STRING_SELECT, Fields.BORDEE],
			]
		)
	})

	it('proposent toutes les troops et bordées, sans présélection par défaut', () => {
		const [, troop, bordee] = buildCadetForm(ids.target).components
		assert.deepEqual(
			troop.component.options.map((option) => option.value),
			['t1', 't2', 't3', 't8', 't9', 'tqg']
		)
		assert.deepEqual(
			bordee.component.options.map((option) => option.label),
			['Bordée 1', 'Bordée 2']
		)
		assert.ok(troop.component.options.every((option) => !option.default))
		assert.equal(troop.component.required, true)
		// interdit par Discord dans un formulaire
		assert.equal(troop.component.disabled, undefined)
	})

	it('sont pré-remplis avec ce qu\'on sait du membre', () => {
		const form = buildCadetForm(ids.target, { displayName: 'Recrue.Kieffer-8Fsl', name: 'Kieffer', troop: 't8', bordee: 'b2' })
		assert.equal(form.custom_id, CADET_FORM_PREFIX + ids.target)
		assert.equal(form.title, 'Recruter en cadet : Recrue.Kieffer-8Fsl')
		const [name, troop, bordee] = form.components
		assert.equal(name.component.value, 'Kieffer')
		assert.deepEqual(
			troop.component.options.filter((option) => option.default).map((option) => option.value),
			['t8']
		)
		assert.deepEqual(
			bordee.component.options.filter((option) => option.default).map((option) => option.value),
			['b2']
		)
	})

	it('le champ texte n\'a pas son propre libellé (porté par le label)', () => {
		const [name] = buildEnrolForm(ids.target).components
		assert.equal(name.component.label, undefined)
		assert.equal(name.component.value, undefined)
		assert.equal(name.component.max_length, 20)
	})

	it('coupent un titre trop long', () => {
		const form = buildEnrolForm(ids.target, { displayName: 'x'.repeat(60) })
		assert.equal(form.title.length, 45)
	})

	it('lisent les valeurs envoyées', () => {
		assert.deepEqual(readRankForm({ commando_name: 'Kieffer', troop: ['t1'], bordee: ['b2'] }), {
			nom: 'Kieffer',
			troop: 't1',
			bordee: 'b2',
		})
		assert.deepEqual(readRankForm({ commando_name: 'Kieffer', troop: [], bordee: 'b1' }), {
			nom: 'Kieffer',
			troop: undefined,
			bordee: 'b1',
		})
		assert.deepEqual(readRankForm({}), { nom: undefined, troop: undefined, bordee: undefined })
	})
})

describe('autres formulaires', () => {
	it('respectent les limites de Discord', () => {
		for (const form of [COMPLAINT_FORM, RECRUITMENT_FORM_1, RECRUITMENT_FORM_2, RECRUITMENT_FORM_3, buildLinkForm(ids.target)]) {
			assertValidModal(form)
		}
	})

	it('le formulaire de lien liste les derniers inscrits', () => {
		const form = buildLinkForm(ids.target, [
			{ user_id: 7526, username: 'MoziSkync' },
			{ user_id: 7525, username: 'DrakJarma' },
		])
		assert.equal(form.custom_id, LINK_FORM_PREFIX + ids.target)
		assert.equal(form.components[1].components[0].value, 'NOM = "MoziSkync", ID = 7526\nNOM = "DrakJarma", ID = 7525')
	})
})
