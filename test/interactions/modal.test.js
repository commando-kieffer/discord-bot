import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readModalValues } from '../../src/interactions/modal.js'

describe('readModalValues', () => {
	it('lit les champs texte de l\'ancien format (lignes d\'actions)', () => {
		const components = [
			{ type: 1, components: [{ type: 4, custom_id: 'commando_name', value: 'Kieffer' }] },
			{ type: 1, components: [{ type: 4, custom_id: 'platform', value: 'PC' }] },
		]
		assert.deepEqual(readModalValues(components), { commando_name: 'Kieffer', platform: 'PC' })
	})

	it('lit les champs texte et les listes déroulantes dans des labels', () => {
		const components = [
			{ type: 18, id: 1, component: { type: 4, id: 2, custom_id: 'commando_name', value: 'Kieffer' } },
			{ type: 18, id: 3, component: { type: 3, id: 4, custom_id: 'troop', values: ['t1'] } },
			{ type: 18, id: 5, component: { type: 3, id: 6, custom_id: 'bordee', values: [] } },
		]
		assert.deepEqual(readModalValues(components), { commando_name: 'Kieffer', troop: ['t1'], bordee: [] })
	})

	it('accepte les deux formats mélangés', () => {
		const components = [
			{ type: 1, components: [{ type: 4, custom_id: 'a', value: '1' }] },
			{ type: 18, component: { type: 4, custom_id: 'b', value: '2' } },
		]
		assert.deepEqual(readModalValues(components), { a: '1', b: '2' })
	})

	it('ignore les éléments sans identifiant ou mal formés', () => {
		const components = [null, {}, { type: 10, content: 'texte' }, { type: 18, component: { type: 4, value: 'x' } }]
		assert.deepEqual(readModalValues(components), {})
		assert.deepEqual(readModalValues(), {})
	})
})
