"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, PlusCircle, ArrowDown, ArrowUp } from "lucide-react";
import { collection, addDoc, getDocs, Timestamp, query, orderBy, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { transactionSchema, type Transaction } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { db, app } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const auth = getAuth(app);
  const user = auth.currentUser;

  const form = useForm<Transaction>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "expense",
      date: new Date(),
      hasAdvance: false,
      advanceAmount: 0,
    },
  });

  const watchedCategory = form.watch("category");
  const watchedHasAdvance = form.watch("hasAdvance");

  useEffect(() => {
    if (watchedCategory === 'Salario') {
      form.setValue('type', 'income');
    }
  }, [watchedCategory, form]);
  
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "transactions"), 
          where("userId", "==", user.uid),
          orderBy("date", "desc")
        );
        const querySnapshot = await getDocs(q);
        const transactionsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            date: (data.date as Timestamp).toDate(),
          } as Transaction;
        });
        setTransactions(transactionsData);
      } catch (error) {
        console.error("Error al obtener transacciones: ", error);
        toast({
          title: "Error",
          description: "No se pudieron obtener las transacciones.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [toast, user]);


  async function onSubmit(data: Transaction) {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para añadir una transacción.",
        variant: "destructive",
      });
      return;
    }
    
    const transactionData: any = {
      ...data,
      userId: user.uid,
      date: Timestamp.fromDate(data.date),
    };

    if (data.category !== 'Salario' || !data.hasAdvance) {
      delete transactionData.hasAdvance;
      delete transactionData.advanceAmount;
    }

    try {
      await addDoc(collection(db, "transactions"), transactionData);
      
      const newTransactions = [data, ...transactions].sort((a,b) => b.date.getTime() - a.date.getTime());
      setTransactions(newTransactions);

      toast({
        title: "Transacción Añadida",
        description: `${data.description} por $${data.amount} ha sido registrada.`,
      });
      form.reset();
    } catch (error) {
      console.error("Error al añadir transacción: ", error);
       toast({
        title: "Error",
        description: "No se pudo añadir la transacción.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6 animate-fade-in">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Nueva Transacción</CardTitle>
            <CardDescription>Registra un ingreso o un gasto manualmente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input placeholder="ej. Café" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                          disabled={watchedCategory === 'Salario'}
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="income" />
                            </FormControl>
                            <FormLabel className="font-normal">Ingreso</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="expense" />
                            </FormControl>
                            <FormLabel className="font-normal">Gasto</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Food">Comida</SelectItem>
                          <SelectItem value="Transport">Transporte</SelectItem>
                          <SelectItem value="Housing">Vivienda</SelectItem>
                          <SelectItem value="Entertainment">Entretenimiento</SelectItem>
                          <SelectItem value="Salary">Salario</SelectItem>
                          <SelectItem value="Side Hustle">Extra</SelectItem>
                          <SelectItem value="Other">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {watchedCategory === 'Salario' && (
                  <>
                    <FormField
                      control={form.control}
                      name="hasAdvance"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>¿Adelanto de Salario?</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {watchedHasAdvance && (
                       <FormField
                         control={form.control}
                         name="advanceAmount"
                         render={({ field }) => (
                           <FormItem>
                             <FormLabel>Monto del Adelanto</FormLabel>
                             <FormControl>
                               <Input type="number" placeholder="0.00" {...field} />
                             </FormControl>
                             <FormMessage />
                           </FormItem>
                         )}
                       />
                    )}
                  </>
                )}

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Transacción
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Transacciones Recientes</CardTitle>
            <CardDescription>Tus últimos movimientos financieros registrados.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  transactions.map((tx, index) => {
                    const finalAmount = tx.hasAdvance && tx.advanceAmount ? tx.amount - tx.advanceAmount : tx.amount;
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{tx.description}</TableCell>
                        <TableCell>
                          {tx.type === 'income' ? (
                            <span className="flex items-center text-primary"><ArrowUp className="mr-1 h-4 w-4" /> Ingreso</span>
                          ) : (
                            <span className="flex items-center text-destructive"><ArrowDown className="mr-1 h-4 w-4" /> Gasto</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline">{tx.category}</Badge></TableCell>
                        <TableCell>{format(tx.date, "PPP")}</TableCell>
                        <TableCell className={`text-right font-mono`}>
                          {tx.hasAdvance && tx.advanceAmount ? (
                             <div className="flex flex-col items-end">
                                <span className="text-xs text-muted-foreground line-through">${tx.amount.toFixed(2)}</span>
                                <span className={tx.type === 'income' ? 'text-primary' : ''}>
                                  {tx.type === 'income' ? '+' : '-'}${finalAmount.toFixed(2)}
                                </span>
                             </div>
                          ) : (
                            <span className={tx.type === 'income' ? 'text-primary' : ''}>
                              {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
