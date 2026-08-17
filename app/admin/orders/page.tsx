import OrdersWorkQueue from "@/components/admin/orders/OrdersWorkQueue";
import {
  getAdminOrdersWorkQueueData,
  parseAdminOrderFilters,
} from "@/lib/orders/admin-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const getQueryValue = (
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) => {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseAdminOrderFilters(resolvedSearchParams);
  const data = await getAdminOrdersWorkQueueData(filters);

  return (
    <OrdersWorkQueue
      data={{
        ...data,
        orders: data.orders.map((order) => ({
          ...order,
          orderDate: order.orderDate.toISOString(),
          preparedAt: order.preparedAt?.toISOString() || null,
          shippedAt: order.shippedAt?.toISOString() || null,
          deliveredAt: order.deliveredAt?.toISOString() || null,
          statusChangedAt: order.statusChangedAt.toISOString(),
          sla: order.sla
            ? { ...order.sla, dueAt: order.sla.dueAt.toISOString() }
            : null,
        })),
      }}
      statusMessage={getQueryValue(resolvedSearchParams, "status")}
      errorMessage={getQueryValue(resolvedSearchParams, "error")}
    />
  );
}
