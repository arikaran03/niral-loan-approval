import { Link } from "react-router-dom";
import "./NotFound.css";

export default function PageNotFound() {
  const type = localStorage.getItem('type');

  return (
    <div className="notfound-wrapper">
      <div className="cosmic-container">
        <div className="stars"></div>
        <div className="twinkling"></div>
        
        <div className="content-container">
          <div className="astronaut-container">
            <div className="astronaut">
              <div className="helmet">
                <div className="visor"></div>
              </div>
              <div className="body">
                <div className="arm left"></div>
                <div className="arm right"></div>
              </div>
              <div className="jetpack"></div>
              <div className="legs">
                <div className="leg left"></div>
                <div className="leg right"></div>
              </div>
            </div>
            <div className="floating-objects">
              <div className="planet"></div>
              <div className="satellite"></div>
              <div className="comet"></div>
            </div>
          </div>

          <div className="text-content">
            <h1 className="glitch" data-text="404">404</h1>
            <h2>Lost in Space?</h2>
            <p className="subtext">
              The page you're looking for has been abducted!<br/>
              Don't worry, our team of cosmic engineers is on it.
            </p>
            
            <Link 
              to={type === "applicant" ? "/loan" : "/console"} 
              className="home-button"
            >
              <span className="button-text">Beam Me Home</span>
              <div className="button-icon">
                <div className="rocket">
                  <div className="flame"></div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <footer className="cosmic-footer">
          <small>&copy; {new Date().getFullYear()} DocuSift - Navigating the digital cosmos</small>
        </footer>
      </div>
    </div>
  );
}