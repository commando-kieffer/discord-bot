import { createDatabase } from './clients/database.js'
import { createDiscordClient } from './clients/discord.js'
import { createXenforoClient } from './clients/xenforo.js'
import { createCommandRegistry } from './commands/registry.js'
import { createComplaintsFeature } from './features/complaints.js'
import { createFunFeature } from './features/fun.js'
import { createInfoFeature } from './features/info.js'
import { createMembersFeature } from './features/members.js'
import { createProfileFeature } from './features/profile.js'
import { createRecruitmentFeature } from './features/recruitment.js'
import { createInteractionHandler } from './interactions/handler.js'
import { createDiscordService } from './services/discord.js'
import { createForumService } from './services/forum/index.js'

// Assemble les dépendances du bot. Les tests construisent les mêmes objets avec des doublures.
export function createContainer({ config, content, logger }) {
	const db = createDatabase(config.db)

	const discord = createDiscordService({
		client: createDiscordClient({ token: config.discord.token }),
		appId: config.discord.appId,
		guildId: config.discord.guildId,
	})

	const forum = createForumService({
		db,
		xenforo: createXenforoClient(config.forum),
		logger: logger.child('forum'),
		game: content.game,
	})

	const features = {
		fun: createFunFeature(),
		info: createInfoFeature({ content }),
		profile: createProfileFeature({ forum, content, logger: logger.child('profil') }),
		complaints: createComplaintsFeature({ discord, forum, logger: logger.child('plaintes') }),
		members: createMembersFeature({ discord, forum, config, logger: logger.child('membres') }),
		recruitment: createRecruitmentFeature({ discord, forum, config, logger: logger.child('recrutement') }),
	}

	return {
		db,
		discord,
		forum,
		features,
		handleInteraction: createInteractionHandler({ config, features, logger: logger.child('interactions') }),
		registry: createCommandRegistry({ discord, logger: logger.child('commandes') }),
	}
}
