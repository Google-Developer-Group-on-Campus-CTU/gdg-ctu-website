import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      countContactMessages,
      deleteContactMessage,
      getContactMessageById,
      getContactMessages,
      insertContactMessage,
      updateContactMessage,
} from "./models/contact-message.queries.js";
import {
      CreateContactMessageDTO,
      SubmitContactMessageDTO,
      UpdateContactMessageDTO,
} from "./contact-messages.validations.js";

export const createContactMessageService = async (
      data: SubmitContactMessageDTO | CreateContactMessageDTO,
) => {
      return insertContactMessage(data);
};

export const getContactMessagesService = async (pagination: Pagination) => {
      const [items, total] = await Promise.all([
            getContactMessages(pagination),
            countContactMessages(),
      ]);
      return {
            items,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getContactMessageByIdService = async (id: string) => {
      const item = await getContactMessageById(id);
      if (!item) {
            throw new AppError(404, "Contact message not found");
      }
      return item;
};

export const updateContactMessageService = async (
      id: string,
      data: UpdateContactMessageDTO,
) => {
      const existing = await getContactMessageById(id);
      if (!existing) {
            throw new AppError(404, "Contact message not found");
      }
      return updateContactMessage(id, { ...data, updatedAt: new Date() });
};

export const deleteContactMessageService = async (id: string) => {
      const existing = await getContactMessageById(id);
      if (!existing) {
            throw new AppError(404, "Contact message not found");
      }
      await deleteContactMessage(id);
};
