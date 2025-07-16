"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Trash2 } from "lucide-react"
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";

import { billSchema, type Bill } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton";

interface BillWithId extends Bill {
    id: string;
}

export default function SchedulerPage() {
  const [bills, setBills] = useState<BillWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<Bill>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: "",
      amount: 0,
      dueDate: undefined,
    },
  });

  useEffect(() => {
    const fetchBills = async () => {
        try {
            const q = query(collection(db, "bills"), orderBy("dueDate", "asc"));
            const querySnapshot = await getDocs(q);
            const billsData = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dueDate: (data.dueDate as Timestamp).toDate(),
                } as BillWithId;
            });
            setBills(billsData);
        } catch (error) {
            console.error("Error al obtener facturas: ", error);
            toast({
                title: "Error",
                description: "No se pudieron obtener las facturas.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    fetchBills();
  }, [toast]);

  async function onSubmit(data: Bill) {
     try {
        const docRef = await addDoc(collection(db, "bills"), {
            ...data,
            dueDate: Timestamp.fromDate(data.dueDate),
        });
        setBills(prev => [...prev, { ...data, id: docRef.id }].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()));
        toast({
            title: "Factura Programada",
            description: `${data.name} por $${data.amount} ha sido añadida.`,
        });
        form.reset();
    } catch (error) {
        console.error("Error al añadir factura: ", error);
        toast({
            title: "Error",
            description: "No se pudo programar la factura.",
            variant: "destructive",
        });
    }
  }
  
  async function removeBill(id: string) {
    const billToRemove = bills.find(b => b.id === id);
    if (!billToRemove) return;

    try {
        await deleteDoc(doc(db, "bills", id));
        setBills(prev => prev.filter((bill) => bill.id !== id));
        toast({
            title: "Factura Eliminada",
            description: `${billToRemove.name} ha sido eliminada del calendario.`,
            variant: "destructive"
        });
    } catch (error) {
        console.error("Error al eliminar factura: ", error);
        toast({
            title: "Error",
            description: "No se pudo eliminar la factura.",
            variant: "destructive",
        });
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 animate-fade-in">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Programar una Factura</CardTitle>
            <CardDescription>Añade un nuevo recordatorio de factura a tu calendario.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Factura</FormLabel>
                      <FormControl>
                        <Input placeholder="ej. Netflix" {...field} />
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
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Vencimiento</FormLabel>
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
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Elige una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Factura
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Facturas Próximas</CardTitle>
             <CardDescription>Una lista de tus recordatorios de pago programados.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  bills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.name}</TableCell>
                      <TableCell>{format(bill.dueDate, "PPP")}</TableCell>
                      <TableCell className="text-right">${bill.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => removeBill(bill.id)}>
                         <Trash2 className="h-4 w-4 text-destructive" />
                       </Button>
                    </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
