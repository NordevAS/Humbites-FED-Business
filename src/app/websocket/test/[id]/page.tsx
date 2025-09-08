"use client";

import { useParams } from 'next/navigation';
import React, { useState, useEffect } from 'react';

interface orderInterface {
    id: string;
    totalPrice: number;
    createdAt: Date;
    completedAt: Date;
    OrderItems: {
        id: string;
        price: number;
        quantity: number;
        Item: {
            name: string;
        };
    }[];
}

const TestWebSocket = () => {
    const { id } = useParams();

    const [order, setOrder] = useState<orderInterface | null >(null);

    useEffect(() => {
        const socket = new WebSocket('ws://localhost:3000/');

        socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'subscribeOrder', orderId: id }));
        };

        socket.onmessage = (event) => {
            setOrder(event.data);
        };

        socket.onclose = () => {
        };

        socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        };

        return () => {
        if (socket) {
            socket.close();
        }
        };
    }, []);

    if (!order) {
        return (
        <div className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md space-y-4">
            <h1 className="text-2xl font-bold">Order Details</h1>
            <p>Loading order details...</p>
        </div>
        );
    }

    console.log(order);

    return (
        <div className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md space-y-4">
        <h1 className="text-2xl font-bold">Order Details</h1>
        {order ? (
            <div>
            <p><strong>Order ID:</strong> {order.id}</p>
            <p><strong>Total Price:</strong> ${order.totalPrice}</p>
            <p><strong>Created At:</strong> {new Date(order.createdAt).toLocaleString()}</p>
            <p><strong>Completed At:</strong> {order.completedAt ? new Date(order.completedAt).toLocaleString() : "Pending"}</p>
            <h2 className="text-xl font-semibold mt-4">Items</h2>
            <ul className="list-disc pl-5">
                {order.OrderItems.map((item) => (
                <li key={item.id} className="mt-2">
                    {item.Item.name} - ${item.price} x {item.quantity}
                </li>
                ))}
            </ul>
            </div>
        ) : (
            <p>Loading order details...</p>
        )}
        <hr className="my-4" />
    </div>
    );
};

export default TestWebSocket;