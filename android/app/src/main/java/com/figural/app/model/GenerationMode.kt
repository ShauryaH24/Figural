package com.figural.app.model

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountTree
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.ui.graphics.vector.ImageVector

enum class GenerationMode(
    val displayName: String,
    val icon: ImageVector,
    val prompt: String
) {
    UI_MOCKUP(
        displayName = "UI Mockup → SwiftUI",
        icon = Icons.Outlined.PhoneAndroid,
        prompt = """
            Analyze this hand-drawn UI mockup and generate SwiftUI code.
            
            Instructions:
            1. Describe the layout you see in the drawing
            2. Generate complete, working SwiftUI code that recreates this design
            3. Use modern SwiftUI patterns and best practices
            4. Include proper spacing, padding, and alignment
            5. Suggest 2-3 improvements to enhance the design
            
            Format your response with clear sections for Description, SwiftUI Code, and Suggestions.
        """.trimIndent()
    ),

    WIREFRAME(
        displayName = "Wireframe → React",
        icon = Icons.Outlined.Dashboard,
        prompt = """
            Analyze this hand-drawn wireframe and generate React components.
            
            Instructions:
            1. Identify all UI elements and their hierarchy
            2. Generate React functional components using Tailwind CSS for styling
            3. Create reusable component structure
            4. Include responsive design considerations
            5. Add appropriate TypeScript types
            
            Format your response with component descriptions followed by the complete code.
        """.trimIndent()
    ),

    DIAGRAM(
        displayName = "Diagram → Mermaid",
        icon = Icons.Outlined.AccountTree,
        prompt = """
            Analyze this hand-drawn diagram and convert it to Mermaid chart syntax.
            
            Instructions:
            1. Detect the diagram type (flowchart, sequence, class, state, ER, etc.)
            2. Identify all nodes, connections, and labels
            3. Output valid Mermaid syntax that recreates the diagram
            4. Include any annotations or notes visible in the drawing
            
            Provide the Mermaid code in a code block that can be directly used.
        """.trimIndent()
    ),

    DESIGN_FEEDBACK(
        displayName = "Design Feedback",
        icon = Icons.Outlined.Edit,
        prompt = """
            Provide professional design feedback on this hand-drawn sketch.
            
            Instructions:
            1. What works well in this design - identify strengths
            2. Potential usability or visual issues
            3. Specific actionable suggestions for improvement
            4. Consider accessibility, visual hierarchy, and user experience
            5. Rate the overall design concept (1-10) with explanation
            
            Be constructive and specific in your feedback.
        """.trimIndent()
    ),

    FLOWCHART(
        displayName = "Flowchart → Swift",
        icon = Icons.Outlined.Article,
        prompt = """
            Analyze this hand-drawn flowchart and convert it to Swift code.
            
            Instructions:
            1. First, write pseudocode that represents the logic in the flowchart
            2. Identify decision points, loops, and process steps
            3. Generate clean, well-documented Swift implementation
            4. Use appropriate Swift patterns (guard statements, enums, etc.)
            5. Include error handling where appropriate
            
            Structure your response with Pseudocode section followed by Swift Implementation.
        """.trimIndent()
    )
}
