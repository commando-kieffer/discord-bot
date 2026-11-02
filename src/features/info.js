import {
	ASSIGN_INITIAL_ROLES_COMMAND,
	FIRE_COMMAND,
	HELP_COMMAND,
	INFOS_SPE_COMMAND,
	INFOS_SITES_COMMAND,
	LINK_COMMAND,
	LINK_MODAL_COMMAND,
	RECRUITMENT_FORM_1_COMMAND,
	RECRUITMENT_FORM_2_COMMAND,
	RECRUITMENT_FORM_3_COMMAND,
	TEST_COMMAND,
	INFOS_GENERALES_COMMAND,
	CIVILS_NON_VUS_COMMAND,
	START_RECRUITMENT_COMMAND,
	PROFILE_COMMAND,
	GET_USERNAME_COMMAND,
	COIN_FLIP_COMMAND,
} from '../commands/definitions.js'

const HELP_MESSAGE = `
**__Pour les nouvelles recrues__**
- \`/${RECRUITMENT_FORM_1_COMMAND.name}\` => ${RECRUITMENT_FORM_1_COMMAND.description}
- \`/${RECRUITMENT_FORM_2_COMMAND.name}\` => ${RECRUITMENT_FORM_2_COMMAND.description}
- \`/${RECRUITMENT_FORM_3_COMMAND.name}\` => ${RECRUITMENT_FORM_3_COMMAND.description}

**__Pour tout le monde__**
- \`/${HELP_COMMAND.name}\` => ${HELP_COMMAND.description}
- \`/${TEST_COMMAND.name}\` => ${TEST_COMMAND.description}
- \`/${COIN_FLIP_COMMAND.name}\` => ${COIN_FLIP_COMMAND.description}
- [Action] \`${GET_USERNAME_COMMAND.name}\` => Affiche le pseudo du membre sélectionné
- \`/${INFOS_GENERALES_COMMAND.name}\` => ${INFOS_GENERALES_COMMAND.description}
- \`/${INFOS_SITES_COMMAND.name}\` => ${INFOS_SITES_COMMAND.description}
- \`/${INFOS_SPE_COMMAND.name}\` => ${INFOS_SPE_COMMAND.description}
- \`/${PROFILE_COMMAND.name}\` => ${PROFILE_COMMAND.description}

**__Pour les QM, Instructeurs, Recruteurs__**
- \`/${CIVILS_NON_VUS_COMMAND.name}\` => ${CIVILS_NON_VUS_COMMAND.description}
- \`/${LINK_COMMAND.name}\` => ${LINK_COMMAND.description}
- \`/${ASSIGN_INITIAL_ROLES_COMMAND.name}\` => ${ASSIGN_INITIAL_ROLES_COMMAND.description}
- [Action] \`${LINK_MODAL_COMMAND.name}\` => ${LINK_COMMAND.description}
- [Action] \`${START_RECRUITMENT_COMMAND.name}\` => Démarre la phase de recrutement (donne les permissions pour remplir le formulaire de recrutement)

**__Pour l'État-Major__**
- [Action] \`${FIRE_COMMAND.name}\` => Radiation du membre sélectionné
`

const GENERAL_INFOS_MESSAGE = `
    **__Information générales__**
    =)
    `

// Les liens et textes viennent de data/content.json
const renderWebsites = (sections) =>
	`\n${sections
		.map(
			({ title, groups }) =>
				`**__${title}__**\n\n${groups.map((group) => group.map(({ label, url }) => `${label} : ${url}`).join('\n')).join('\n\n')}`
		)
		.join('\n\n')}\n`

export function createInfoFeature({ content }) {
	const help = async () => ({ status: 200, message: HELP_MESSAGE })

	const displayGeneralInfos = async () => ({ status: 200, message: GENERAL_INFOS_MESSAGE })

	const displayWebsites = async () => ({ status: 200, message: renderWebsites(content.websites) })

	const displaySpe = async () => ({ status: 200, message: `\n${content.spe.join('\n')}\n` })

	return { help, displayGeneralInfos, displayWebsites, displaySpe }
}
