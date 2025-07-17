
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addMonths, addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, setDate, lastDayOfMonth } from "date-fns";
import { Calendar as CalendarIcon, PlusCircle, ArrowDown, ArrowUp, Pencil } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import { DateRange } from "react-day-picker";

import { transactionSchema, type Transaction, type LoanDetails } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useFirebase } from "@/hooks/use-firebase";


type FormValues = Transaction & {
  loanDetails?: LoanDetails;
}

type TransactionWithId = Transaction & { id: string };

type FilterType = "recent" | "today" | "month" | "date" | "range";

export default function TransactionsPage() {
  const { user, db, firebaseUtils } = useFirebase();
  const [transactions, setTransactions] = useState<TransactionWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("recent");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithId | null>(null);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "expense",
      date: new Date(),
      hasAdvance: false,
      advanceAmount: 0,
      loanDetails: {
        loanId: '',
        totalAmount: 0,
        installments: 0,
        frequency: 'monthly',
        startDate: new Date(),
      }
    },
  });

  const watchedCategory = form.watch("category");
  const watchedHasAdvance = form.watch("hasAdvance");

  
  const fetchTransactions = useCallback(async (uid: string) => {
    if (!db || !firebaseUtils) return;
    setLoading(true);

    const { collection, query, where, orderBy, getDocs, Timestamp, limit } = firebaseUtils;

    try {
        let q;
        const baseQuery = collection(db, "transactions");
        let constraints: any[] = [where("userId", "==", uid)];

        switch (filterType) {
            case "today":
                constraints.push(where("date", ">=", Timestamp.fromDate(startOfDay(new Date()))));
                constraints.push(where("date", "<=", Timestamp.fromDate(endOfDay(new Date()))));
                break;
            case "month":
                constraints.push(where("date", ">=", Timestamp.fromDate(startOfMonth(new Date()))));
                constraints.push(where("date", "<=", Timestamp.fromDate(endOfMonth(new Date()))));
                break;
            case "date":
                if (date) {
                    constraints.push(where("date", ">=", Timestamp.fromDate(startOfDay(date))));
                    constraints.push(where("date", "<=", Timestamp.fromDate(endOfDay(date))));
                }
                break;
            case "range":
                if (dateRange?.from) {
                     constraints.push(where("date", ">=", Timestamp.fromDate(startOfDay(dateRange.from))));
                }
                if (dateRange?.to) {
                     constraints.push(where("date", "<=", Timestamp.fromDate(endOfDay(dateRange.to))));
                }
                break;
            case "recent":
                 constraints.push(orderBy("date", "desc"));
                 constraints.push(limit(5));
                 break;
        }

        if (filterType !== "recent") {
            constraints.push(orderBy("date", "desc"));
        }
        
        q = query(baseQuery, ...constraints);
        const querySnapshot = await getDocs(q);
        const transactionsData = querySnapshot.docs.map((doc: any) => {
            const data = doc.data();
            const loanDetails = data.loanDetails && data.loanDetails.startDate ? {
                ...data.loanDetails,
                startDate: (data.loanDetails.startDate as Timestamp).toDate(),
            } : undefined;

            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate(),
                loanDetails,
            } as TransactionWithId;
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
  }, [filterType, date, dateRange, toast, db, firebaseUtils]);

  useEffect(() => {
    if (user) {
        fetchTransactions(user.uid);
    } else {
        setTransactions([]);
        setLoading(false);
    }
  }, [user, fetchTransactions]);

  useEffect(() => {
    if (watchedCategory !== 'Préstamo') {
      form.setValue('loanDetails', undefined);
    }
  }, [watchedCategory, form]);


  async function onSubmit(data: FormValues) {
    if (!user || !db || !firebaseUtils) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para añadir una transacción.",
        variant: "destructive",
      });
      return;
    }
    
    const { collection, addDoc, Timestamp, writeBatch, doc } = firebaseUtils;
    
    const transactionData: Omit<Transaction, 'id'> = {
      description: data.description,
      amount: data.amount,
      type: data.type,
      category: data.category,
      userId: user.uid,
      date: data.date,
      hasAdvance: data.hasAdvance,
      advanceAmount: data.advanceAmount,
    };
    
    if (data.category === 'Préstamo' && data.loanDetails) {
        transactionData.loanDetails = {
            ...data.loanDetails,
            startDate: Timestamp.fromDate(data.loanDetails.startDate)
        } as any;
    }

    try {
      const docRef = await addDoc(collection(db, "transactions"), {
        ...transactionData,
        date: Timestamp.fromDate(transactionData.date)
      });
      
      if (data.category === 'Préstamo' && data.loanDetails) {
        const { loanId, totalAmount, installments, frequency, startDate } = data.loanDetails;
        const installmentAmount = totalAmount / installments;
        const batch = writeBatch(db);

        let currentDueDate: Date | undefined = startDate;

        for (let i = 0; i < installments; i++) {
          let dueDate: Date;

          if (i === 0) {
              dueDate = currentDueDate;
          } else {
              if (frequency === 'monthly') {
                  currentDueDate = addMonths(currentDueDate, 1);
              } else { // bi-weekly logic
                  const lastPaymentDay = currentDueDate.getDate();
                  if (lastPaymentDay <= 15) {
                      currentDueDate = setDate(currentDueDate, 15);
                      if (currentDueDate < addDays(startDate, i * 14)) { // Ensure we move forward in time
                          currentDueDate = lastDayOfMonth(currentDueDate);
                      }
                  } else {
                      currentDueDate = lastDayOfMonth(currentDueDate);
                  }

                  if (currentDueDate <= addDays(startDate, i * 14)) {
                     currentDueDate = addMonths(currentDueDate,1);
                     currentDueDate = setDate(currentDueDate, 15);
                  }
              }
              dueDate = currentDueDate;
          }

          const billData = {
            name: `Cuota ${i + 1}/${installments} - Préstamo ${loanId}`,
            amount: installmentAmount,
            dueDate: Timestamp.fromDate(dueDate),
            userId: user.uid,
          };
          const billRef = doc(collection(db, "bills"));
          batch.set(billRef, billData);

          // Update currentDueDate for the next iteration if it's bi-weekly
           if (i < installments - 1 && frequency === 'bi-weekly') {
              const lastPaymentDay = dueDate.getDate();
              if (lastPaymentDay <= 15) {
                  currentDueDate = lastDayOfMonth(dueDate);
              } else {
                  currentDueDate = setDate(addMonths(dueDate, 1), 15);
              }
           }
        }
        await batch.commit();
      }
      
      const newTransaction = { ...transactionData, id: docRef.id, date: transactionData.date, loanDetails: data.loanDetails };
      setTransactions(prev => [newTransaction as TransactionWithId, ...prev].sort((a,b) => b.date.getTime() - a.date.getTime()));

      toast({
        title: "Transacción Añadida",
        description: `${data.description} por $${data.amount.toLocaleString()} ha sido registrada.`,
      });
      form.reset({
        description: "",
        amount: 0,
        type: "expense",
        date: new Date(),
        category: undefined,
        hasAdvance: false,
        advanceAmount: 0,
        loanDetails: {
            loanId: '',
            totalAmount: 0,
            installments: 0,
            frequency: 'monthly',
            startDate: new Date(),
        }
      });
    } catch (error) {
      console.error("Error al añadir transacción: ", error);
       toast({
        title: "Error",
        description: "No se pudo añadir la transacción.",
        variant: "destructive",
      });
    }
  }

  async function onUpdate(data: FormValues) {
    if (!editingTransaction || !db || !firebaseUtils) return;

    const { doc, updateDoc, Timestamp } = firebaseUtils;

    const transactionData: Partial<FormValues> = { ...data };

    try {
      const transactionRef = doc(db, "transactions", editingTransaction.id);
      
      if (transactionData.loanDetails && transactionData.loanDetails.startDate) {
        transactionData.loanDetails = {
            ...transactionData.loanDetails,
            startDate: Timestamp.fromDate(transactionData.loanDetails.startDate),
        } as any;
      }
      
      await updateDoc(transactionRef, {
        ...transactionData,
        date: Timestamp.fromDate(data.date),
      });

      toast({
        title: "Transacción Actualizada",
        description: "La transacción ha sido actualizada exitosamente.",
      });
      setEditModalOpen(false);
      setEditingTransaction(null);
      if (user) await fetchTransactions(user.uid);
    } catch (error) {
      console.error("Error al actualizar la transacción:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la transacción.",
        variant: "destructive",
      });
    }
  }
  
  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    if (newFilter !== 'date' && newFilter !== 'range') {
      setDate(undefined);
      setDateRange(undefined);
    }
  }
  
  function handleEditClick(transaction: TransactionWithId) {
    setEditingTransaction(transaction);
    const startDate = transaction.loanDetails?.startDate;
    const isDate = startDate instanceof Date && !isNaN(startDate.valueOf());
    
    form.reset({
      ...transaction,
      date: transaction.date,
      loanDetails: transaction.loanDetails ? {
          ...transaction.loanDetails,
          startDate: isDate ? startDate : new Date(),
      } : {
        loanId: '',
        totalAmount: 0,
        installments: 0,
        frequency: 'monthly',
        startDate: new Date(),
      }
    });
    setEditModalOpen(true);
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
        <div className="lg:w-1/3 flex-shrink-0">
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
                          <Input type="number" placeholder="0.00" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
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
                            value={field.value}
                            className="flex space-x-4"
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
                        <Select onValueChange={(value) => {
                            field.onChange(value);
                            if (value !== 'Préstamo') {
                              form.setValue('loanDetails', undefined, { shouldValidate: true });
                            }
                        }} value={field.value}>
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
                            <SelectItem value="Salario">Salario</SelectItem>
                            <SelectItem value="Préstamo">Préstamo</SelectItem>
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
                               <FormDescription>
                                Al activar, el monto del adelanto se restará del salario total.
                              </FormDescription>
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
                                 <Input type="number" placeholder="0.00" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                      )}
                    </>
                  )}

                  {watchedCategory === 'Préstamo' && (
                    <Card className="p-4 bg-muted/30">
                      <CardTitle className="text-lg mb-4">Detalles del Préstamo</CardTitle>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="loanDetails.loanId"
                          render={({ field }) => (
                            <FormItem><FormLabel>ID del Préstamo</FormLabel><FormControl><Input placeholder="ej. PREST-001" {...field} /></FormControl><FormMessage /></FormItem>
                          )}
                        />
                         <FormField
                            control={form.control}
                            name="loanDetails.totalAmount"
                            render={({ field }) => (
                              <FormItem><FormLabel>Monto Total del Préstamo</FormLabel><FormControl><Input type="number" placeholder="5000.00" {...field} onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                  form.setValue('amount', value);
                              }} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                        <FormField
                          control={form.control}
                          name="loanDetails.installments"
                          render={({ field }) => (
                            <FormItem><FormLabel>Nº de Cuotas</FormLabel><FormControl><Input type="number" placeholder="12" {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="loanDetails.frequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Frecuencia de Pago</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Seleccionar frecuencia" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="monthly">Mensual</SelectItem>
                                  <SelectItem value="bi-weekly">Quincenal</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                            control={form.control}
                            name="loanDetails.startDate"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Fecha de Inicio de Pago</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                    </Card>
                  )}


                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Transacción</FormLabel>
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

        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Transacciones</CardTitle>
              <CardDescription>Busca y filtra tus movimientos financieros.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-muted/50 rounded-lg">
                  <Button variant={filterType === 'recent' ? 'default' : 'ghost'} onClick={() => handleFilterChange('recent')}>Recientes</Button>
                  <Button variant={filterType === 'today' ? 'default' : 'ghost'} onClick={() => handleFilterChange('today')}>Hoy</Button>
                  <Button variant={filterType === 'month' ? 'default' : 'ghost'} onClick={() => handleFilterChange('month')}>Este Mes</Button>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button variant={filterType === 'date' ? 'default' : 'ghost'}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {date ? format(date, "PPP") : "Fecha"}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                          <Calendar
                              mode="single"
                              selected={date}
                              onSelect={(d) => { setDate(d); handleFilterChange('date'); }}
                              initialFocus
                          />
                      </PopoverContent>
                  </Popover>
                  <Popover>
                      <PopoverTrigger asChild>
                         <Button variant={filterType === 'range' ? 'default' : 'ghost'}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                               {dateRange?.from ? (
                                  dateRange.to ? (
                                    `${format(dateRange.from, "LLL dd")} - ${format(dateRange.to, "LLL dd, y")}`
                                  ) : (
                                    format(dateRange.from, "LLL dd, y")
                                  )
                                ) : (
                                  "Rango"
                                )}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                              mode="range"
                              defaultMonth={dateRange?.from}
                              selected={dateRange}
                              onSelect={(range) => { setDateRange(range); handleFilterChange('range'); }}
                              numberOfMonths={2}
                          />
                      </PopoverContent>
                  </Popover>
               </div>
               <div className="space-y-4">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="p-4 rounded-lg border">
                        <div className="flex justify-between mb-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    ))
                  ) : transactions.length > 0 ? (
                    transactions.map((tx: TransactionWithId, index: number) => {
                      const finalAmount = tx.hasAdvance && tx.advanceAmount ? tx.amount - tx.advanceAmount : tx.amount;
                      return (
                         <div key={tx.id}>
                          <div className="p-4 rounded-lg relative group">
                            <Button variant="ghost" size="icon" className="absolute bottom-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEditClick(tx)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-xs font-mono text-muted-foreground">ID#{tx.id.substring(0, 5).toUpperCase()}</p>
                              <div className="font-semibold text-right">
                                {tx.hasAdvance && tx.advanceAmount ? (
                                  <div className="flex flex-col items-end">
                                    <span className={tx.type === 'income' ? 'text-primary' : 'text-destructive'}>
                                      {tx.type === 'income' ? '+' : '-'}${finalAmount.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-muted-foreground line-through">${tx.amount.toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <span className={tx.type === 'income' ? 'text-primary' : 'text-destructive'}>
                                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-muted-foreground">DESCRIPCIÓN</p>
                                <p className="font-medium truncate">{tx.description}</p>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                      <p className="text-xs text-muted-foreground">TIPO</p>
                                      <div className="font-medium flex items-center">{tx.type === 'income' ? <ArrowUp className="mr-1 h-4 w-4 text-primary" /> : <ArrowDown className="mr-1 h-4 w-4 text-destructive" />} {tx.type === 'income' ? 'Ingreso' : 'Gasto'}</div>
                                  </div>
                                  <div className="flex-1">
                                      <p className="text-xs text-muted-foreground">CATEGORÍA</p>
                                      <div><Badge variant="outline">{tx.category}</Badge></div>
                                  </div>
                              </div>
                              <div>
                                  <p className="text-xs text-muted-foreground">FECHA</p>
                                  <p className="font-medium">{format(tx.date, "PPP")}</p>
                              </div>
                               {tx.hasAdvance && tx.advanceAmount && (
                                <div>
                                    <p className="text-xs text-muted-foreground">ADELANTO DE SALARIO</p>
                                    <p className="font-medium">${tx.advanceAmount.toFixed(2)}</p>
                                </div>
                               )}
                               {tx.category === 'Préstamo' && tx.loanDetails && (
                                <div className="grid grid-cols-3 gap-2 pt-2 mt-2 border-t border-dashed">
                                    <div>
                                        <p className="text-xs text-muted-foreground">ID PRÉSTAMO</p>
                                        <p className="font-medium text-xs truncate">{tx.loanDetails.loanId}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">CUOTAS</p>
                                        <p className="font-medium text-xs">{tx.loanDetails.installments}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">FRECUENCIA</p>
                                        <p className="font-medium text-xs capitalize">{tx.loanDetails.frequency === 'monthly' ? 'Mensual' : 'Quincenal'}</p>
                                    </div>
                                </div>
                               )}
                            </div>
                          </div>
                          {index < transactions.length - 1 && <Separator />}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No se encontraron transacciones para el filtro seleccionado.</p>
                  )}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Editar Transacción</DialogTitle>
                <DialogDescription>
                    Actualiza los detalles de la transacción seleccionada.
                </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-4 -mr-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-4">
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
                            <Input type="number" placeholder="0.00" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
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
                              value={field.value}
                              className="flex space-x-4"
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
                          <Select onValueChange={field.onChange} value={field.value}>
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
                              <SelectItem value="Salario">Salario</SelectItem>
                              <SelectItem value="Préstamo">Préstamo</SelectItem>
                              <SelectItem value="Side Hustle">Extra</SelectItem>
                              <SelectItem value="Other">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                      {watchedCategory === 'Préstamo' && (
                      <Card className="p-4 bg-muted/30">
                        <CardTitle className="text-lg mb-4">Detalles del Préstamo</CardTitle>
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="loanDetails.loanId"
                            render={({ field }) => (
                              <FormItem><FormLabel>ID del Préstamo</FormLabel><FormControl><Input placeholder="ej. PREST-001" {...field} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                          <FormField
                              control={form.control}
                              name="loanDetails.totalAmount"
                              render={({ field }) => (
                                <FormItem><FormLabel>Monto Total del Préstamo</FormLabel><FormControl><Input type="number" placeholder="5000.00" {...field} onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                    form.setValue('amount', value);
                                }} /></FormControl><FormMessage /></FormItem>
                              )}
                            />
                          <FormField
                            control={form.control}
                            name="loanDetails.installments"
                            render={({ field }) => (
                              <FormItem><FormLabel>Nº de Cuotas</FormLabel><FormControl><Input type="number" placeholder="12" {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="loanDetails.frequency"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Frecuencia de Pago</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar frecuencia" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="monthly">Mensual</SelectItem>
                                    <SelectItem value="bi-weekly">Quincenal</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                              control={form.control}
                              name="loanDetails.startDate"
                              render={({ field }) => (
                                <FormItem className="flex flex-col">
                                  <FormLabel>Fecha de Inicio de Pago</FormLabel>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <FormControl>
                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                                          {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                      </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                        </div>
                      </Card>
                    )}
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Fecha de Transacción</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                  {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="sticky bottom-0 bg-background pt-4 -mb-4 pb-6">
                      <Button type="submit">Actualizar Transacción</Button>
                    </DialogFooter>
                  </form>
              </Form>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}



