import { TROOP, BORDEE } from '../ranks.js'

export const COMMAND_TYPE = {
  CHAT_INPUT: 1,
  USER: 2, // action on user
}

export const COMMAND_NAMES = {

  HELP: 'ck-help',

  TEST: 'coucou',

  // Lier un utilisateur discord au forum
  LINK: 'lien',
  LINK_MODAL: 'Lier au forum',

  // Pour retirer les droits
  FIRE: 'Radier',

  // Pour mettre les droits initiaux
  ASSIGN_INITIAL_ROLES: 'recrutement',

  // Pour questionnaires de recrutement
  START_RECRUITMENT: 'Lancer le recrutement',
  RECRUITMENT_FORM_1: 'questionnaire-1',
  RECRUITMENT_FORM_2: 'questionnaire-2',
  RECRUITMENT_FORM_3: 'questionnaire-3',

  // infos
  INFOS_SITES: 'infos-sites',
  INFOS_SPE: 'spe',
  INFOS_GENERALES: 'infos',

  // infos membre
  PROFILE: 'profil',
  GET_USERNAME: 'Donne le pseudo',

  CIVILS_NON_VUS: 'civils-non-vus',

  COMPLAINT: 'plainte',

  COIN_FLIP: 'flip'
}

export const TEST_COMMAND = {
  name: COMMAND_NAMES.TEST,
  description: 'Commande de test du service',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const HELP_COMMAND = {
  name: COMMAND_NAMES.HELP,
  description: 'Affiche la liste des commandes disponibles',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const CIVILS_NON_VUS_COMMAND = {
  name: COMMAND_NAMES.CIVILS_NON_VUS,
  description: 'Affiche les civils en attente non vus',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const COMPLAINT_COMMAND = {
  name: COMMAND_NAMES.COMPLAINT,
  description: 'Ecrire une doléance',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const PROFILE_COMMAND = {
  name: COMMAND_NAMES.PROFILE,
  description: 'Affiche quelques informations sur votre profil',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const GET_USERNAME_COMMAND = {
  name: COMMAND_NAMES.GET_USERNAME,
  type: COMMAND_TYPE.USER, // action on user
}

export const INFOS_GENERALES_COMMAND = {
  name: COMMAND_NAMES.INFOS_GENERALES,
  description: 'Affiches les informations générales concernant le CK',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const INFOS_SITES_COMMAND = {
  name: COMMAND_NAMES.INFOS_SITES,
  description: 'Affiches les pages importantes des sites du CK',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const INFOS_SPE_COMMAND = {
  name: COMMAND_NAMES.INFOS_SPE,
  description: 'Affiche la liste des spé arme',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const RECRUITMENT_FORM_1_COMMAND = {
  name: COMMAND_NAMES.RECRUITMENT_FORM_1,
  description: 'Formulaire de recrutement du commando Kieffer (1/3)',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const RECRUITMENT_FORM_2_COMMAND = {
  name: COMMAND_NAMES.RECRUITMENT_FORM_2,
  description: 'Formulaire de recrutement du commando Kieffer (2/3)',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const RECRUITMENT_FORM_3_COMMAND = {
  name: COMMAND_NAMES.RECRUITMENT_FORM_3,
  description: 'Formulaire de recrutement du commando Kieffer (3/3)',
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const LINK_COMMAND = {
  name: COMMAND_NAMES.LINK,
  description: 'Créé un lien entre un compte discord et un compte forum',
  options: [
    {
      type: 6, // user
      name: 'commando',
      description: 'Choisissez le commando à lier',
      required: true,
    }, {
      type: 4, // int
      name: 'id-forum',
      description: 'Identifiant (ID) forum de la recrue',
      required: true,
    },
  ],
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const LINK_MODAL_COMMAND = {
  name: COMMAND_NAMES.LINK_MODAL,
  type: COMMAND_TYPE.USER, // action on user
}

export const FIRE_COMMAND = {
  name: COMMAND_NAMES.FIRE,
  type: COMMAND_TYPE.USER, // action on user
}

export const START_RECRUITMENT_COMMAND = {
  name: COMMAND_NAMES.START_RECRUITMENT,
  type: COMMAND_TYPE.USER, // action on user
}

export const ASSIGN_INITIAL_ROLES_COMMAND = {
  name: COMMAND_NAMES.ASSIGN_INITIAL_ROLES,
  description: 'Donne les persmissions à la nouvelle recrue',
  options: [
    {
      type: 6, // user
      name: 'commando',
      description: 'Choisissez le commando à lier',
      required: true,
    }, {
      type: 3, // string
      name: 'nom',
      description: 'Nom choisi par la recrue',
      required: true
    }, {
      type: 3, // string
      name: 'troop',
      description: 'Troop de la recrue',
      required: true,
      choices: Object.keys(TROOP).map(x => ({ name: x, value: TROOP[x] }))
    }, {
      type: 3, // string
      name: 'bordee',
      description: 'Bordée de la recrue',
      required: true,
      choices: Object.keys(BORDEE).map(x => ({ name: x, value: BORDEE[x] }))
    },
  ],
  type: COMMAND_TYPE.CHAT_INPUT,
}

export const COIN_FLIP_COMMAND = {
  name: COMMAND_NAMES.COIN_FLIP,
  description: 'Pile ou face',
  type: COMMAND_TYPE.CHAT_INPUT,
}

// Commandes déclarées auprès de Discord au démarrage
export const REGISTERED_COMMANDS = [
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
  COMPLAINT_COMMAND,
  COIN_FLIP_COMMAND
]

// Commandes qui n'existent plus, à supprimer chez Discord au démarrage
export const REMOVED_COMMANDS = []
