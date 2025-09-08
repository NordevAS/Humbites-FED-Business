import NavBar from "@/components/Layout/Header/NavBar";
import "./orders.css"
import OrderList from "./tempobj";

// ORDRER NUMMER
// DELIVER STATUS
// DATO
// KLOKKESLETT
// NAVN




export default function Orders() {
    return(
        <div id="screen">
            <NavBar />
            <main>
                <section id="OrderList">
                    <OrderList
                        businessId={1}
                    />
                </section>
                <section id="OrderInfo">

                </section>
            </main>
        </div>
    )
}