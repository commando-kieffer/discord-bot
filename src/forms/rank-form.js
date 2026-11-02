import { MessageComponentTypes } from 'discord-interactions'
import { BORDEE_LABELS, TROOP_LABELS } from '../ranks.js'

// Composant « label » des formulaires (texte au-dessus d'un champ), pas encore exporté par discord-interactions.
// C'est lui qui permet de mettre des listes déroulantes dans un formulaire.
export const LABEL = 18

export const ENROL_FORM_PREFIX = 'enrol-form-'
export const CADET_FORM_PREFIX = 'cadet-form-'

// Limite de Discord sur le titre d'un formulaire
const TITLE_MAX_LENGTH = 45

export const Fields = {
	COMMANDO_NAME: 'commando_name',
	TROOP: 'troop',
	BORDEE: 'bordee',
}

const select = (customId, placeholder, labels, selected) => ({
	type: MessageComponentTypes.STRING_SELECT,
	custom_id: customId,
	placeholder,
	required: true,
	options: Object.entries(labels).map(([value, label]) => ({
		label,
		value,
		...(value === selected ? { default: true } : {}),
	})),
})

const title = (prefix, displayName) => (displayName ? `${prefix} ${displayName}` : prefix).slice(0, TITLE_MAX_LENGTH)

// Nom, troop et bordée, pré-remplis avec ce qu'on sait déjà du membre
const buildRankForm = (customId, formTitle, defaults = {}) => ({
	custom_id: customId,
	title: formTitle,
	components: [
		{
			type: LABEL,
			label: 'Nom de commando',
			component: {
				type: MessageComponentTypes.INPUT_TEXT,
				custom_id: Fields.COMMANDO_NAME,
				style: 1,
				required: true,
				min_length: 2,
				max_length: 20,
				placeholder: 'Nom choisi dans la liste',
				...(defaults.name ? { value: defaults.name } : {}),
			},
		},
		{
			type: LABEL,
			label: 'Troop',
			component: select(Fields.TROOP, 'Choisir la troop', TROOP_LABELS, defaults.troop),
		},
		{
			type: LABEL,
			label: 'Bordée',
			component: select(Fields.BORDEE, 'Choisir la bordée', BORDEE_LABELS, defaults.bordee),
		},
	],
})

export const buildEnrolForm = (userId, { displayName, ...defaults } = {}) =>
	buildRankForm(ENROL_FORM_PREFIX + userId, title('Enrôler', displayName), defaults)

export const buildCadetForm = (userId, { displayName, ...defaults } = {}) =>
	buildRankForm(CADET_FORM_PREFIX + userId, title('Recrutement de', displayName), defaults)

// Le nom arrive en texte, la troop et la bordée en listes d'une seule valeur
const first = (value) => (Array.isArray(value) ? value[0] : value)

export const readRankForm = (values) => ({
	nom: values[Fields.COMMANDO_NAME],
	troop: first(values[Fields.TROOP]),
	bordee: first(values[Fields.BORDEE]),
})
