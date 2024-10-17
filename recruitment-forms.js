import { MessageComponentTypes } from 'discord-interactions';


export const Fields = {
  DISCORD_ID: 'discord_id',
  DISCORD_USERNAME: 'discord_username',
  COMMANDO_NAME: 'commando_name',
  GAME_STYLE: 'game_style',
  MAIN_PLATFORM: 'platform',
  PLATFORM_USERNAME: 'platform_username',
  FIRSTNAME: 'firstname',
  COMMENT: 'comment',
  CAN_BE_PRESENT: 'can_be_present',
  CAN_PAY: 'can_pay',
  SKILLS_DEV: 'skills_dev',
  SKILLS_DESIGN: 'skills_design',
  SKILLS_VIDEO: 'skills_video',
  HOW_KNOW_US: 'how_know_us',
}

export const RECRUITMENT_FORM_1_ID = 'recruitment-form-1'

export const RECRUITMENT_FORM_1 = {
    custom_id: RECRUITMENT_FORM_1_ID,
    title: 'Formulaire de recrutement 1/3',
    components: [
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: Fields.COMMANDO_NAME,
            style: 1,
            label: 'Nom de commando',
            placeholder: 'Nom choisi dans la liste',
          },
        ],
      },
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: Fields.GAME_STYLE,
            style: 1,
            label: 'Quel est votre style de jeu ?',
            placeholder: 'Fusil d\'assaut, hardcore',
          },
        ],
      },
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: Fields.MAIN_PLATFORM,
            style: 1,
            label: 'Plateforme principale',
            min_length: 2,
            placeholder: 'PC/PlayStation/Xbox',
          },
        ],
      },
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: Fields.PLATFORM_USERNAME,
            style: 1,
            label: 'Identifiant en jeu',
            min_length: 3,
            placeholder: 'Pseudo#1234',
          },
        ],
      },
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: Fields.FIRSTNAME,
            style: 1,
            label: 'Quel est votre prénom ?',
            min_length: 3,
          },
        ],
      },
    ],
  }


export const RECRUITMENT_FORM_2_ID = 'recruitment-form-2'

export const RECRUITMENT_FORM_2 = {
    custom_id: RECRUITMENT_FORM_2_ID,
    title: 'Formulaire de recrutement 2/3',
    components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: Fields.CAN_BE_PRESENT,
              style: 1,
              label: 'Pouvez vous être présent les vendredi ?',
              min_length: 1,
              max_length: 1,
              placeholder: 'O/N'
            },
          ],
        },
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: Fields.CAN_PAY,
              style: 1,
              label: 'Pouvez vous payer la cotisation de 10e ?',
              min_length: 1,
              max_length: 1,
              placeholder: 'O/N'
            },
          ],
        },
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: Fields.HOW_KNOW_US,
              style: 1,
              label: 'Comment avez vous entendu parler du CK ?',
              min_length: 3,
              placeholder: 'Par un ami ? Groupe Facebook ?'
            },
          ],
        },
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: Fields.COMMENT,
              style: 1,
              label: 'Avez vous un commentaire à formuler',
              required: false,
            },
          ],
        },
    ],
}

export const RECRUITMENT_FORM_3_ID = 'recruitment-form-3'

export const RECRUITMENT_FORM_3 = {
    custom_id: RECRUITMENT_FORM_3_ID,
    title: 'Formulaire de recrutement 3/3',
    components: [
        
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: Fields.SKILLS_DEV,
            style: 1,
            label: 'Avez vous des compétences en programmation ?',
            min_length: 1,
            max_length: 1,
            placeholder: 'O/N'
          },
        ],
      },
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: Fields.SKILLS_DESIGN,
            style: 1,
            label: 'Avez vous des compétences en design ?',
            min_length: 1,
            max_length: 1,
            placeholder: 'O/N'
          },
        ],
      },
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: Fields.SKILLS_VIDEO,
            style: 1,
            label: 'Avez vous des compétences en montage ?',
            min_length: 1,
            max_length: 1,
            placeholder: 'O/N'
          },
        ],
      },
    ],
}
