export const fetchBusinessOrders = async (businessId: number) => {
    try {
        const response = await fetch(`http://localhost:3000/businesses/${businessId}/orders`);

        if (!response.ok) {
            throw new Error("Network response was not ok" + response.status) ;
        }

        const data = await response.json();
        return data;
    } catch (err: any) {
        throw new Error('Issue fetching business orders:' + err.message);
    }
}