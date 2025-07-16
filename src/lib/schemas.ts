import * as z from "zod";

export const transactionSchema = z.object({
  description: z.string().min(2, { message: "La descripción debe tener al menos 2 caracteres." }),
  amount: z.coerce.number().positive({ message: "El monto debe ser un número positivo." }),
  type: z.enum(["income", "expense"], { required_error: "Debes seleccionar un tipo de transacción." }),
  category: z.string({ required_error: "Por favor, selecciona una categoría." }),
  date: z.date({ required_error: "Se requiere una fecha." }),
});

export type Transaction = z.infer<typeof transactionSchema>;


export const billSchema = z.object({
  name: z.string().min(2, { message: "Se requiere el nombre de la factura." }),
  amount: z.coerce.number().positive({ message: "El monto debe ser positivo." }),
  dueDate: z.date({ required_error: "Se requiere una fecha de vencimiento." }),
});

export type Bill = z.infer<typeof billSchema>;
