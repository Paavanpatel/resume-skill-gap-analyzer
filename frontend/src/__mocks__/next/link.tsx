import React from "react";

const Link = ({ children, href, ...props }: any) => (
  <a href={href} {...props}>
    {children}
  </a>
);

export default Link;
