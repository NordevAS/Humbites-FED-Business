'use client';

import { fetchBusinessOrders } from "@/app/services/api/orders/fetchBusinessOrders";
import React, { useEffect } from "react";

interface OrderListProps {
    businessId: number;
}

interface Order {
    id: number;
    userId: number;
    businessId: number;
    paymentMethod: string;
    transactionId: string;
    status: string;
    cancelledAt: string;
    completedAt: string;
    createdAt: string;
    updatedAt: string;
    totalPrice: string;
    OrderItems: {
        id: number;
        itemId: number;
        couponId: number;
        price: string;
        quantity: number;
        Item: {
            name: string;
        };
    }[];
}

const OrderList: React.FC<OrderListProps> = ({
    businessId,
}) => {
    const [orders, setOrders] = React.useState<Order[] | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchBusinessOrders(businessId);
                setOrders(response);
            } catch (error) {
                console.error(error);
            }
        };
        fetchData();
    }, []);

    if (!orders) {
        return (
            <div>
                <h1>Loading...</h1>
            </div>
        );
    }

    return (
        <div>
            {orders.map((order) => (
                <div key={order.transactionId} id="cardOrder">
                    <h3>{order.id}</h3>
                    <p>{order.status}</p>
                    <p>{order.createdAt}</p>
                    {order.OrderItems.map((item) => (
                        <div key={item.id}>
                            <h4>{item.Item.name}</h4>
                            <p>{item.price}</p>
                            <p>{item.quantity}</p>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default OrderList;