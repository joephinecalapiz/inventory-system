function FloatingOrb() {
  return (
    <div className="floating-orb-stage" aria-hidden="true">
      <div className="floating-orb-glow floating-orb-glow-one" />
      <div className="floating-orb-glow floating-orb-glow-two" />
      <div className="floating-orb">
        <div className="floating-orb-highlight" />
        <div className="floating-orb-reflection" />
        <div className="floating-orb-core" />
      </div>
    </div>
  );
}

export default FloatingOrb;
