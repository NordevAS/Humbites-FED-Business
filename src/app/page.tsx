"use client";
import Link from "next/link";
import NavBar from "@/components/Layout/Header/NavBar";
import MapArea from "../app/maparea/page";
import "./main.css";

export default function CompanyHome() {
  return (
    <div className="page-wrapper">
      <NavBar />
      <div className="content-wrapper">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Welcome back, (username)</h1>
          <div className="user-profile">
            <span className="language-badge">ENG (US)</span>
            <div className="avatar"></div>
            <span className="user-name">Sander sandkaker</span>
          </div>
        </div>
        <main className="dash-contain">
          {/* TOP CARDS */}
          <div className="dash-card graphs-card" id="card-graphs">
            <h2 className="section-title">Graphs</h2>
            <p className="section-subtitle"></p>
            <div className="color-blocks">
              <div className="color-block block-pink">
                <p className="block-label">Daily</p>
              </div>
              <div className="color-block block-orange">
                <p className="block-label">Weekly</p>
              </div>
              <div className="color-block block-blue">
                <p className="block-label">Yearly</p>
              </div>
              <div className="color-block block-green">
                <p className="block-label">All Time</p>
              </div>
            </div>
          </div>
          <div className="dash-card create-card" id="card-create">
            <h2 className="section-title">Manage your menu</h2>
            {/* The corrected code for the menu manager button */}
            <Link href="/app/menuManager" className="menu-manager-button">
              Menu Manager
            </Link>
          </div>
          {/* GRID CARDS */}
          <div className="dash-card orders-card" id="card-orders">
            <h2 className="section-title">Orders</h2>
            <div className="see-more-container">
              <Link href="#" className="see-more">
                see more &gt;
              </Link>
            </div>
          </div>
          <div className="dash-card shifts-card" id="card-shifts">
            <h2 className="section-title">Shifts</h2>
            <ul className="shifts-list">
              <li className="shift-item">
                <span className="shift-name">Leah:</span> 8:00 - 15:00
              </li>
              <li className="shift-item">
                <span className="shift-name">Sander:</span> 8:00 - 23:00
              </li>
              <li className="shift-item">
                <span className="shift-name">Per:</span> 5:00 - 11:00
              </li>
              <li className="shift-item">
                <span className="shift-name">Miriam:</span> 16:00 - 20:00
              </li>
            </ul>
            <div className="see-more-container">
              <Link href="#" className="see-more">
                see more &gt;
              </Link>
            </div>
          </div>
          <div className="dash-card area-card" id="card-area">
            <MapArea />
          </div>
          <div className="dash-card sander-card" id="card-sander">
            <h2 className="section-title">Sander er cringe</h2>
            <div className="see-more-container">
              <Link href="#" className="see-more">
                see more &gt;
              </Link>
            </div>
          </div>
          <div className="dash-card deals-card" id="card-deals">
            <h2 className="section-title">Deals</h2>
            <div className="see-more-container">
              <Link href="#" className="see-more">
                see more &gt;
              </Link>
            </div>
          </div>
          <div className="dash-card call-card" id="card-call">
            <h2 className="section-title">Call list</h2>
            <div className="see-more-container">
              <Link href="#" className="see-more">
                see more &gt;
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
