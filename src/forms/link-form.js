import { MessageComponentTypes } from 'discord-interactions'

export const LINK_FORM_PREFIX = 'link-form-'

export const Fields = {
	FORUM_ID: 'forum-id',
	LAST_USERS: 'last-users',
}

export const buildLinkForm = (userToLink, lastUsers = []) => ({
	// user_to_link: userToLink,
	custom_id: LINK_FORM_PREFIX + userToLink,
	title: 'Lien entre compte Discord et Forum',
	components: [
		{
			type: MessageComponentTypes.ACTION_ROW,
			components: [
				{
					type: MessageComponentTypes.INPUT_TEXT,
					custom_id: Fields.FORUM_ID,
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
					custom_id: Fields.LAST_USERS,
					style: 2,
					label: 'Derniers utilisateurs',
					required: false,
					value: lastUsers.map(({ user_id, username }) => `NOM = "${username}", ID = ${user_id}`).join('\n'),
				},
			],
		},
	],
})
