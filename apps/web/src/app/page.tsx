"use client";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section with Gradient Background */}
      <div className="w-full h-[50vh] relative bg-gradient-to-r from-[#9B7E6B] via-[#A89082] to-[#B5A399]">
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-gray-800 px-4">
            <h1 className="text-5xl font-bold mb-4">Travel Buddy AI</h1>
            <p className="text-xl mb-8">
              Your personal AI travel companion for discovering amazing places
            </p>
            <a
              href="/chat"
              className="inline-block px-8 py-4 bg-[#F5E6D3] text-gray-800 rounded-lg hover:bg-[#E6D7C4] transition-colors text-lg"
            >
              Start Exploring
            </a>
          </div>
        </div>
      </div>

      {/* Two Images Section */}
      <div className="w-full grid grid-cols-2 gap-0">
        <div className="h-[50vh]">
          <img
            src="/images/andrea-cau-nV7GJmSq3zc-unsplash.jpg"
            alt="City view"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="h-[50vh]">
          <img
            src="/images/hanin-abouzeid-aeq8gJ5ZkcA-unsplash.jpg"
            alt="Hanin's travel photograph"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Description Section */}
      <div className="w-full bg-gray-50 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">About Travel Buddy AI</h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Travel Buddy AI is your intelligent travel companion, designed to help you discover and plan amazing adventures. 
            Using advanced AI technology, we provide personalized travel recommendations, local insights, and 
            real-time assistance to make your journey unforgettable. Whether you're planning a weekend getaway or 
            a world tour, Travel Buddy AI is here to guide you every step of the way.
          </p>
        </div>
      </div>
    </main>
  );
}
