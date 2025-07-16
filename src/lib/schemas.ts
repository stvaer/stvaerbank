import * as z from "zod";

export const loanSchema = z.object({
  loanId: z.string().min(1, "Se requiere un ID para el préstamo."),
  totalAmount: z.coerce.number().positive("El monto total debe ser positivo."),
  installments: z.coerce.number().int().min(1, "Debe haber al menos una cuota."),
  frequency: z.enum(["monthly", "bi-weekly"], { required_error: "Debes seleccionar una frecuencia." }),
  startDate: z.date({ required_error: "Se requiere una fecha de inicio de pago." }),
});

export type LoanDetails = z.infer<typeof loanSchema>;

export const transactionSchema = z.object({
  description: z.string().min(2, { message: "La descripción debe tener al menos 2 caracteres." }),
  amount: z.coerce.number().positive({ message: "El monto debe ser un número positivo." }),
  type: z.enum(["income", "expense"], { required_error: "Debes seleccionar un tipo de transacción." }),
  category: z.string({ required_error: "Por favor, selecciona una categoría." }),
  date: z.date({ required_error: "Se requiere una fecha." }),
  userId: z.string().optional(),
  hasAdvance: z.boolean().optional(),
  advanceAmount: z.coerce.number().optional(),
  loanDetails: loanSchema.optional(),
}).refine(data => {
    if (data.hasAdvance) {
        return data.advanceAmount !== undefined && data.advanceAmount > 0;
    }
    return true;
}, {
    message: "El monto del adelanto es requerido.",
    path: ["advanceAmount"],
}).refine(data => {
    if (data.hasAdvance && data.advanceAmount) {
        return data.advanceAmount < data.amount;
    }
    return true;
}, {
    message: "El adelanto no puede ser mayor al monto total.",
    path: ["advanceAmount"],
}).refine(data => {
    if (data.category === 'Préstamo') {
        return !!data.loanDetails;
    }
    return true;
}, {
    message: "Los detalles del préstamo son requeridos.",
    path: ["loanDetails"],
});

export type Transaction = z.infer<typeof transactionSchema>;


export const billSchema = z.object({
  name: z.string().min(2, { message: "Se requiere el nombre de la factura." }),
  amount: z.coerce.number().positive({ message: "El monto debe ser positivo." }),
  dueDate: z.date({ required_error: "Se requiere una fecha de vencimiento." }),
  userId: z.string().optional(), // Added for security rules
});

export type Bill = z.infer<typeof billSchema>;
