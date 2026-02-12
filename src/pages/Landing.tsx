import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showContent, setShowContent] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        setShowPlayOverlay(true);
      });
    }

    const handleEnded = () => {
      startTransition();
    };

    const handleError = () => {
      console.log("Video failed to load, starting app directly.");
      startTransition();
    };

    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, []);

  const startTransition = () => {
    setShowContent(true);
    setTimeout(() => {
      setIsActive(true);
    }, 200);
    setTimeout(() => {
      setIsActive(true);
    }, 600);
  };

  const handlePlayClick = () => {
    const video = videoRef.current;
    if (video) {
      video.play();
      setShowPlayOverlay(false);
    }
  };

  const handleLaunchPortal = () => {
    if (user) {
      navigate("/", { replace: true });
      window.location.reload();
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="landing-page min-h-screen relative overflow-hidden transition-colors duration-[1500ms] ease-in-out"
         style={{ backgroundColor: "#eef4f9" }}>

      <div className={`intro-container fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-[800ms] ease-out ${showContent ? "opacity-0 invisible pointer-events-none" : ""}`}
           style={{ backgroundColor: "#eef4f9" }}>
        <video
          ref={videoRef}
          className="intro-video w-full h-full object-cover"
          style={{ mixBlendMode: "multiply" }}
          muted
          playsInline
        >
          <source src="/video_d947dcb3-9916-4d7f-b617-a3beb20d3fdf.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {showPlayOverlay && (
          <button
            onClick={handlePlayClick}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 text-white px-10 py-5 rounded-full cursor-pointer z-[200] font-semibold backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            Start Experience
          </button>
        )}
      </div>

      <div className={`poster-container w-full h-screen flex flex-col justify-center items-center px-5 py-10 relative opacity-0 transition-opacity duration-[1000ms] ease-in ${showContent ? "opacity-100" : ""}`}
           style={isActive ? { background: "linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%)" } : {}}>

        <div className="bg-circle absolute rounded-full bg-white/5 animate-[float_6s_ease-in-out_infinite] z-0" style={{ width: "300px", height: "300px", top: "-100px", right: "-50px" }}></div>
        <div className="bg-circle absolute rounded-full bg-white/5 animate-[float_6s_ease-in-out_infinite]" style={{ width: "200px", height: "200px", bottom: "100px", left: "-50px", animationDelay: "2s" }}></div>
        <div className="bg-circle absolute rounded-full bg-white/5 animate-[float_6s_ease-in-out_infinite]" style={{ width: "150px", height: "150px", top: "50%", right: "-30px", animationDelay: "4s" }}></div>

        <span className="floating-icon absolute text-white/10 text-[30px] animate-[floatRandom_8s_ease-in-out_infinite] z-1" style={{ top: "15%", left: "10%" }}>
          <span className="material-icons">local_hospital</span>
        </span>
        <span className="floating-icon absolute text-white/10 text-[30px] animate-[floatRandom_8s_ease-in-out_infinite]" style={{ top: "25%", right: "15%", animationDelay: "2s" }}>
          <span className="material-icons">medical_services</span>
        </span>
        <span className="floating-icon absolute text-white/10 text-[30px] animate-[floatRandom_8s_ease-in-out_infinite]" style={{ bottom: "25%", left: "12%", animationDelay: "4s" }}>
          <span className="material-icons">health_and_safety</span>
        </span>
        <span className="floating-icon absolute text-white/10 text-[30px] animate-[floatRandom_8s_ease-in-out_infinite]" style={{ bottom: "30%", right: "10%", animationDelay: "1s" }}>
          <span className="material-icons">monitor_heart</span>
        </span>

        <div className="logo-container relative w-[320px] h-[380px] flex justify-center items-center mb-10 z-10 transition-transform duration-[1200ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
             style={{ transform: isActive ? "scale(1)" : "scale(0.9)" }}>

          <div className="cart-wrapper relative w-[320px] h-[380px]">

            <div className="monitor absolute top-[10px] left-1/2 -translate-x-1/2 w-[180px] h-[130px] bg-[#f0f4f8] rounded-xl border-4 border-[#2c3e50] shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-5">
              <div className="screen w-[156px] h-[100px] bg-[#1976D2] mx-2 rounded-md flex justify-center items-center relative overflow-hidden border-2 border-[#2c3e50]">
                <span className="material-icons text-[40px] text-white/90 animate-[iconFloat_3s_ease-in-out_infinite]">analytics</span>
              </div>
            </div>

            <div className="stand-pole absolute left-1/2 top-[140px] -translate-x-1/2 w-[24px] h-[160px] bg-[#e0e0e0] border-l-2 border-r-2 border-[#bdc3c7] z-1"></div>

            <div className="work-surface absolute top-[180px] left-1/2 -translate-x-1/2 w-[220px] h-[15px] bg-white rounded-lg border-3 border-[#2c3e50] z-4 shadow-[0_5px_15px_rgba(0,0,0,0.1)]"></div>

            <div className="keyboard-tray absolute top-[205px] left-1/2 -translate-x-1/2 w-[140px] h-[10px] bg-[#90A4AE] rounded border-2 border-[#2c3e50] z-3"></div>

            <div className="cart-base absolute bottom-[60px] left-1/2 -translate-x-1/2 w-[200px] h-[40px] bg-white rounded-[20px] border-3 border-[#2c3e50] z-2"></div>

            <div className="wheels-container absolute bottom-0 left-1/2 -translate-x-1/2 w-[240px] h-[70px] flex justify-between z-1">
              <div className="wheel w-[60px] h-[60px] bg-white border-3 border-[#2c3e50] rounded-full relative animate-[spin_3s_linear_infinite]">
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top"></div>
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top rotate-120"></div>
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top rotate-240"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] bg-[#2c3e50] rounded-full"></div>
              </div>
              <div className="wheel w-[60px] h-[60px] bg-white border-3 border-[#2c3e50] rounded-full relative animate-[spin_3s_linear_infinite]">
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top"></div>
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top rotate-120"></div>
                <div className="spoke absolute w-1 h-[26px] bg-[#2c3e50] top-1/2 left-1/2 -translate-x-1/2 origin-top rotate-240"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] bg-[#2c3e50] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="title-section text-center relative z-10 -mt-5">
          <h1 className={`main-title font-[Montserrat] text-[56px] font-extrabold text-white tracking-tighter mb-2.5 drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-[800ms] ease-out delay-[500ms] ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
              style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Rolling Rounds
          </h1>
          <p className={`subtitle text-[1.2rem] font-light text-white/90 mb-7.5 transition-all duration-[800ms] ease-out delay-[700ms] ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
             style={{ fontFamily: "'Poppins', sans-serif" }}>
            Medical Rounding & Patient List Management
          </p>

          <div className={`features flex flex-wrap justify-center gap-[15px] mt-5 transition-all duration-[800ms] ease-out delay-[900ms] ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
            <div className="feature-tag bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full text-white text-[0.9rem] font-medium flex items-center gap-2 border border-white/20 hover:bg-white/25 hover:-translate-y-0.5 transition-all">
              <span className="material-icons">devices</span>
              <span>Mobile Access</span>
            </div>
            <div className="feature-tag bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full text-white text-[0.9rem] font-medium flex items-center gap-2 border border-white/20 hover:bg-white/25 hover:-translate-y-0.5 transition-all">
              <span className="material-icons">speed</span>
              <span>Real-time Sync</span>
            </div>
            <div className="feature-tag bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full text-white text-[0.9rem] font-medium flex items-center gap-2 border border-white/20 hover:bg-white/25 hover:-translate-y-0.5 transition-all">
              <span className="material-icons">cloud_done</span>
              <span>HIPAA Secure</span>
            </div>
          </div>
        </div>

        <div className={`cta-section mt-10 transition-all duration-[800ms] ease-out delay-[1100ms] z-10 ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          <button
            onClick={handleLaunchPortal}
            className="cta-button bg-white text-[#1976D2] px-12 py-4 rounded-full text-base font-bold uppercase tracking-wider inline-flex items-center gap-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 hover:scale-105 hover:shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all border-none cursor-pointer outline-none"
          >
            <span>Launch Portal</span>
            <span className="material-icons">login</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(10deg); }
        }
        @keyframes floatRandom {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-20px) rotate(5deg); }
          66% { transform: translateY(10px) rotate(-5deg); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
};

export default Landing;
