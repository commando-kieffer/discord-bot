import { MessageComponentTypes } from 'discord-interactions';


export const Fields = {
    MESSAGE: 'complaint_message',
}

export const COMPLAINT_FORM_ID = 'complaint-form'

export const COMPLAINT_FORM = {
    custom_id: COMPLAINT_FORM_ID,
    title: 'Doléance',
    components: [
        {
            type: MessageComponentTypes.ACTION_ROW,
            components: [
                {
                    type: MessageComponentTypes.INPUT_TEXT,
                    custom_id: Fields.MESSAGE,
                    style: 2,
                    label: 'Votre message',
                    required: true,
                    min_length: 20,
                    max_length: 2048,
                    placeholder: 'Le capitaine est méchant'
                },
            ],
        }
    ],
}