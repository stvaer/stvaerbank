import * as z from "zod";

export const transactionSchema = z.object({
  description: z.string().min(2, { message: "Description must be at least 2 characters." }),
  amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
  type: z.enum(["income", "expense"], { required_error: "You need to select a transaction type." }),
  category: z.string({ required_error: "Please select a category." }),
  date: z.date({ required_error: "A date is required." }),
});

export type Transaction = z.infer<typeof transactionSchema>;


export const billSchema = z.object({
  name: z.string().min(2, { message: "Bill name is required." }),
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  dueDate: z.date({ required_error: "A due date is required." }),
});

export type Bill = z.infer<typeof billSchema>;
