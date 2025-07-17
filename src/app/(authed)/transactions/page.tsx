
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addMonths, addDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { Calendar as CalendarIcon, PlusCircle, ArrowDown, ArrowUp, Search } from "lucide-react";
import { collection, addDoc, getDocs, Timestamp, query, orderBy, where, writeBatch, doc, limit } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { DateRange } from "react-day-picker";

import { transactionSchema, type Transaction, type LoanDetails } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { db, app } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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


type FormValues = Transaction & {
  loanDetails?: LoanDetails;
}

type FilterType = "recent" | "today" | "month" | "date" | "range";


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<(Transaction & {id: string})[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("recent");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const { toast } = useToast();
  const auth = getAuth(app);
  const [user, setUser] = useState(auth.currentUser);

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

  useEffect(() => {
    if (user) {
        fetchTransactions(user.uid);
    }
  }, [user, filterType, date, dateRange]);


  useEffect(() => {
    if (watchedCategory === 'Salario' || watchedCategory === 'Préstamo') {
        form.setValue('type', 'income');
    }
  }, [watchedCategory, form.setValue]);
  
  
  const fetchTransactions = async (uid: string) => {
    setLoading(true);
    try {
        let q;
        const baseQuery = collection(db, "transactions");
        let constraints = [where("userId", "==", uid)];

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
        const transactionsData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate(),
            } as Transaction & { id: string };
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


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        setTransactions([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [auth]);


  async function onSubmit(data: FormValues) {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para añadir una transacción.",
        variant: "destructive",
      });
      return;
    }
    
    const transactionData: any = {
      description: data.description,
      amount: data.amount,
      type: data.type,
      category: data.category,
      userId: user.uid,
      date: Timestamp.fromDate(data.date),
    };

    if (data.category === 'Salario' && data.hasAdvance) {
      transactionData.hasAdvance = data.hasAdvance;
      transactionData.advanceAmount = data.advanceAmount;
    }

    try {
      const docRef = await addDoc(collection(db, "transactions"), transactionData);
      
      if (data.category === 'Préstamo' && data.loanDetails) {
        const { loanId, totalAmount, installments, frequency, startDate } = data.loanDetails;
        const installmentAmount = totalAmount / installments;
        const batch = writeBatch(db);

        for (let i = 0; i < installments; i++) {
          let dueDate: Date;
          if (frequency === 'monthly') {
            dueDate = addMonths(startDate, i);
          } else { // bi-weekly
            dueDate = addDays(startDate, (i + 1) * 15);
          }

          const billData = {
            name: `Cuota ${i + 1}/${installments} - Préstamo ${loanId}`,
            amount: installmentAmount,
            dueDate: Timestamp.fromDate(dueDate),
            userId: user.uid,
          };
          const billRef = doc(collection(db, "bills"));
          batch.set(billRef, billData);
        }
        await batch.commit();
      }
      
      await fetchTransactions(user.uid);

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
  
  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    if (newFilter !== 'date' && newFilter !== 'range') {
      setDate(undefined);
      setDateRange(undefined);
    }
  }

  return (
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
                  transactions.map((tx, index) => {
                    const finalAmount = tx.hasAdvance && tx.advanceAmount ? tx.amount - tx.advanceAmount : tx.amount;
                    return (
                       <div key={tx.id}>
                        <div className="p-4 rounded-lg relative">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-mono text-muted-foreground">ID#{(tx.id || '').substring(0, 5).toUpperCase()}</p>
                            <div className="font-semibold text-right">
                              {tx.hasAdvance && tx.advanceAmount ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-xs text-muted-foreground line-through">${tx.amount.toFixed(2)}</span>
                                  <span className={tx.type === 'income' ? 'text-primary' : 'text-destructive'}>
                                    {tx.type === 'income' ? '+' : '-'}${finalAmount.toFixed(2)}
                                  </span>
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
  );
}
